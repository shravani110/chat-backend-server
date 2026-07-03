import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { JwtPayload } from "../modules/auth/auth.types";
import { roomsService } from "../modules/rooms/rooms.service";
import { presence } from "./presence";
import { registerMessageHandlers } from "./handlers/message.handlers";
import { AppServer } from "./socket.types";

let ioInstance: AppServer | null = null;

/** Access the Socket.io server from REST controllers (e.g. file upload broadcasts). */
export function getIO(): AppServer {
  if (!ioInstance) throw new Error("Socket.io not initialized");
  return ioInstance;
}

export function initSocketServer(httpServer: http.Server): AppServer {
  const io: AppServer = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",") },
  });
  ioInstance = io;

  // Auth middleware: reuse the same JWT access tokens as the REST API
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.slice(7);
    if (!token) return next(new Error("Missing auth token"));
    try {
      socket.data.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    const { user } = socket.data;
    logger.debug(`socket connected: ${user.username} (${socket.id})`);

    // Register handlers FIRST — clients may emit immediately after connecting,
    // before the async room-join/presence setup below finishes.
    registerMessageHandlers(io, socket);

    socket.on("presence:who", async ({ userIds }, ack) => {
      if (!Array.isArray(userIds) || userIds.length > 200) return ack({ online: [] });
      ack({ online: await presence.filterOnline(userIds) });
    });

    try {
      // Join a personal room (for direct emits) + all chat rooms the user belongs to
      await socket.join(`user:${user.sub}`);
      const roomIds = await roomsService.getMyRoomIds(user.sub);
      await socket.join(roomIds);

      // Presence: broadcast only on first connection of this user
      const cameOnline = await presence.connect(user.sub);
      if (cameOnline) {
        for (const roomId of roomIds) {
          socket.to(roomId).emit("presence:online", { userId: user.sub });
        }
      }
    } catch (err) {
      logger.error(err, "socket connection setup failed");
      socket.emit("error", { message: "Connection setup failed" });
      socket.disconnect(true);
      return;
    }

    socket.on("disconnect", async () => {
      logger.debug(`socket disconnected: ${user.username} (${socket.id})`);
      try {
        const wentOffline = await presence.disconnect(user.sub);
        if (wentOffline) {
          const roomIds = await roomsService.getMyRoomIds(user.sub);
          const lastSeenAt = new Date().toISOString();
          for (const roomId of roomIds) {
            io.to(roomId).emit("presence:offline", { userId: user.sub, lastSeenAt });
          }
        }
      } catch (err) {
        logger.error(err, "presence disconnect failed");
      }
    });
  });

  return io;
}
