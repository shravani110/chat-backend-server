/**
 * Standalone worker entrypoint — run as a separate process from the API:
 *   npm run worker        (production, after build)
 *   npm run worker:dev    (development)
 */
import { logger } from "../../utils/logger";
import { prisma } from "../../config/prisma";
import { createFileWorker } from "./file.worker";
import { createNotificationWorker } from "./notification.worker";

const workers = [createFileWorker(), createNotificationWorker()];
logger.info("🛠️  Workers started: file-processing, notifications");

async function shutdown(signal: string) {
  logger.info(`${signal} received, closing workers`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
