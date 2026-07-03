import { Worker } from "bullmq";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { createRedisClient } from "../../config/redis";
import { s3 } from "../../config/storage";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { logger } from "../../utils/logger";
import { FileJobData, QUEUE_NAMES, notificationQueue } from "../queues";

/**
 * Post-upload processing. Free-tier friendly baseline:
 *  - re-verify the object exists and record authoritative metadata
 *  - fan out a notification job
 * Extend here later with thumbnail generation (sharp) or AV scanning.
 */
export function createFileWorker() {
  const worker = new Worker<FileJobData>(
    QUEUE_NAMES.FILE_PROCESSING,
    async (job) => {
      const { messageId, key } = job.data;
      if (!key) return;

      const head = await s3.send(
        new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key })
      );

      const message = await prisma.message.update({
        where: { id: messageId },
        data: {
          fileSize: head.ContentLength ?? undefined,
          mimeType: head.ContentType ?? undefined,
        },
        select: { id: true, roomId: true, senderId: true },
      });

      if (message.senderId) {
        await notificationQueue.add("new-message", {
          type: "new-message",
          messageId: message.id,
          roomId: message.roomId,
          senderId: message.senderId,
        });
      }

      logger.info({ messageId, key }, "file processed");
    },
    { connection: createRedisClient("worker-file"), concurrency: 5 }
  );

  worker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, "file job failed")
  );
  return worker;
}
