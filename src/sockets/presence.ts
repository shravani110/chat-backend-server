import { redis } from "../config/redis";
import { prisma } from "../config/prisma";

const ONLINE_SET = "presence:online"; // set of online user ids
const connKey = (userId: string) => `presence:conn:${userId}`;
const CONN_TTL = 60 * 60 * 24; // safety TTL so crashed servers can't leak keys forever

export const presence = {
  /** Returns true if this was the user's FIRST connection (came online). */
  async connect(userId: string): Promise<boolean> {
    const count = await redis.incr(connKey(userId));
    await redis.expire(connKey(userId), CONN_TTL);
    if (count === 1) {
      await redis.sadd(ONLINE_SET, userId);
      return true;
    }
    return false;
  },

  /** Returns true if this was the user's LAST connection (went offline). */
  async disconnect(userId: string): Promise<boolean> {
    const count = await redis.decr(connKey(userId));
    if (count <= 0) {
      await redis.del(connKey(userId));
      await redis.srem(ONLINE_SET, userId);
      await prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
        .catch(() => {}); // presence must never crash on a race with user deletion
      return true;
    }
    return false;
  },

  async isOnline(userId: string): Promise<boolean> {
    return (await redis.sismember(ONLINE_SET, userId)) === 1;
  },

  async filterOnline(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const flags = await redis.smismember(ONLINE_SET, ...userIds);
    return userIds.filter((_, i) => flags[i] === 1);
  },
};
