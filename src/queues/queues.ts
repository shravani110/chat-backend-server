import { Queue } from "bullmq";
import { createRedisClient } from "../config/redis";

export const QUEUE_NAMES = {
  FILE_PROCESSING: "file-processing",
  NOTIFICATIONS: "notifications",
} as const;

const connection = createRedisClient("bullmq-producer");

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export interface FileJobData {
  messageId: string;
  key: string | null;
}

export interface NotificationJobData {
  type: "new-message";
  messageId: string;
  roomId: string;
  senderId: string;
}

export const fileQueue = new Queue<FileJobData>(QUEUE_NAMES.FILE_PROCESSING, {
  connection,
  defaultJobOptions,
});

export const notificationQueue = new Queue<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATIONS,
  { connection, defaultJobOptions }
);
