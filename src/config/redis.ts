import Redis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

export function createRedisClient(name: string) {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
  });
  client.on("error", (err) => logger.error(err, `Redis(${name}) error`));
  client.on("connect", () => logger.info(`Redis(${name}) connected`));
  return client;
}

export const redis = createRedisClient("main");
