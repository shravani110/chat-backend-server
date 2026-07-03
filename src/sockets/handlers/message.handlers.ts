import { AppServer, AppSocket } from "../socket.types";
import { messagesService } from "../../modules/messages/messages.service";
import { AppError } from "../../utils/errors";
import { logger } from "../../utils/logger";

export function registerMessageHandlers(io: AppServer, socket: AppSocket) {
  const { user } = socket.data;

  socket.on("message:send", async ({ roomId, content }, ack) => {
    try {
      const message = await messagesService.createTextMessage(user.sub, roomId, content);
      io.to(roomId).emit("message:new", message); // includes sender's other devices
      ack?.({ ok: true, message });
    } catch (err) {
      const msg = err instanceof AppError ? err.message : "Failed to send message";
      if (!(err instanceof AppError)) logger.error(err, "message:send failed");
      ack?.({ ok: false, error: msg });
    }
  });

  socket.on("message:read", async ({ roomId }) => {
    await messagesService.markRead(user.sub, roomId).catch(() => {});
  });

  socket.on("typing:start", ({ roomId }) => {
    if (!socket.rooms.has(roomId)) return; // only rooms this socket joined
    socket
      .to(roomId)
      .emit("typing:start", { roomId, userId: user.sub, username: user.username });
  });

  socket.on("typing:stop", ({ roomId }) => {
    if (!socket.rooms.has(roomId)) return;
    socket.to(roomId).emit("typing:stop", { roomId, userId: user.sub });
  });
}
