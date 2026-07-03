import { Worker } from "bullmq";
import { createRedisClient } from "../../config/redis";
import { prisma } from "../../config/prisma";
import { logger } from "../../utils/logger";
import { NotificationJobData, QUEUE_NAMES } from "../queues";

/**
 * Notification fan-out. Baseline implementation logs the recipients of a
 * new message who are offline — the hook point for email / web-push /
 * FCM delivery later.
 */
export function createNotificationWorker() {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      const { roomId, senderId, messageId } = job.data;

      const recipients = await prisma.participant.findMany({
        where: { roomId, userId: { not: senderId } },
        select: { user: { select: { id: true, email: true, username: true } } },
      });

      for (const { user } of recipients) {
        // TODO: replace with real delivery (email provider / web push)
        logger.info(
          { to: user.username, messageId, roomId },
          "notification: new message"
        );
      }
    },
    { connection: createRedisClient("worker-notification"), concurrency: 10 }
  );

  worker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, "notification job failed")
  );
  return worker;
}
