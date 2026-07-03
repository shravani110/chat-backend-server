import { prisma } from "../../config/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { CreateRoomInput } from "./rooms.types";

const MEMBER_USER_SELECT = { id: true, username: true, avatarUrl: true } as const;

export const roomsService = {
  async createRoom(creatorId: string, input: CreateRoomInput) {
    const memberIds = [...new Set([creatorId, ...input.participantIds])];

    if (input.type === "DIRECT") {
      if (memberIds.length !== 2) {
        throw new BadRequestError("DIRECT rooms must have exactly 2 participants");
      }
      // reuse existing DM between the same pair
      const existing = await prisma.room.findFirst({
        where: {
          type: "DIRECT",
          AND: memberIds.map((id) => ({ participants: { some: { userId: id } } })),
        },
        include: {
          participants: { include: { user: { select: MEMBER_USER_SELECT } } },
        },
      });
      if (existing) return existing;
    }

    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    if (users.length !== memberIds.length) {
      throw new BadRequestError("One or more participants do not exist");
    }

    return prisma.room.create({
      data: {
        name: input.type === "GROUP" ? input.name ?? "Untitled room" : null,
        type: input.type,
        creatorId,
        participants: {
          create: memberIds.map((userId) => ({
            userId,
            role: userId === creatorId ? "OWNER" : "MEMBER",
          })),
        },
      },
      include: {
        participants: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
  },

  async listMyRooms(userId: string) {
    return prisma.room.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: MEMBER_USER_SELECT } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }, // last message preview
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  /** Throws unless the user is a participant of the room. Returns the membership. */
  async assertMembership(userId: string, roomId: string) {
    const membership = await prisma.participant.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!membership) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true },
      });
      if (!room) throw new NotFoundError("Room not found");
      throw new ForbiddenError("You are not a member of this room");
    }
    return membership;
  },

  /** Room ids the user belongs to — used to join socket rooms on connect. */
  async getMyRoomIds(userId: string): Promise<string[]> {
    const rows = await prisma.participant.findMany({
      where: { userId },
      select: { roomId: true },
    });
    return rows.map((r) => r.roomId);
  },
};
