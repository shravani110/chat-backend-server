import { prisma } from "../../config/prisma";
import { BadRequestError } from "../../utils/errors";
import { roomsService } from "../rooms/rooms.service";

const SENDER_SELECT = { id: true, username: true, avatarUrl: true } as const;

export const messagesService = {
  async createTextMessage(senderId: string, roomId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 4000) {
      throw new BadRequestError("Message must be 1-4000 characters");
    }
    await roomsService.assertMembership(senderId, roomId);

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: { roomId, senderId, type: "TEXT", content: trimmed },
        include: { sender: { select: SENDER_SELECT } },
      }),
      prisma.room.update({ where: { id: roomId }, data: { updatedAt: new Date() } }),
    ]);
    return message;
  },

  async createFileMessage(
    senderId: string,
    roomId: string,
    file: { key: string; fileName: string; fileSize: number; mimeType: string },
    caption?: string
  ) {
    await roomsService.assertMembership(senderId, roomId);
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          roomId,
          senderId,
          type: "FILE",
          content: caption?.trim() || null,
          fileUrl: file.key,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        },
        include: { sender: { select: SENDER_SELECT } },
      }),
      prisma.room.update({ where: { id: roomId }, data: { updatedAt: new Date() } }),
    ]);
    return message;
  },

  /** Cursor-paginated history, newest first. */
  async getHistory(userId: string, roomId: string, cursor?: string, limit = 50) {
    await roomsService.assertMembership(userId, roomId);
    const pageSize = Math.min(limit, 100);
    const messages = await prisma.message.findMany({
      where: { roomId, deletedAt: null },
      include: { sender: { select: SENDER_SELECT } },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = messages.length > pageSize;
    if (hasMore) messages.pop();
    return {
      messages,
      nextCursor: hasMore ? messages[messages.length - 1]?.id ?? null : null,
    };
  },

  async markRead(userId: string, roomId: string) {
    await roomsService.assertMembership(userId, roomId);
    await prisma.participant.update({
      where: { userId_roomId: { userId, roomId } },
      data: { lastReadAt: new Date() },
    });
  },
};
