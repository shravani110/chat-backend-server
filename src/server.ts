import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { prisma } from "./config/prisma";
import { redis } from "./config/redis";
import { initSocketServer } from "./sockets";
import { createFileWorker } from "./queues/workers/file.worker";
import { createNotificationWorker } from "./queues/workers/notification.worker";

const app = createApp();
const server = http.createServer(app);
const io = initSocketServer(server);

const workers = env.WORKERS_IN_PROCESS
  ? [createFileWorker(), createNotificationWorker()]
  : [];

server.listen(env.PORT, () => {
  logger.info(`🚀 Server listening on port ${env.PORT}`);
  if (workers.length) logger.info("🛠️  BullMQ workers running in-process");
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  io.close();
  await Promise.allSettled(workers.map((w) => w.close()));
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
