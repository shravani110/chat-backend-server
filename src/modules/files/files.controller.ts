import { NextFunction, Request, Response } from "express";
import { filesService } from "./files.service";
import { getIO } from "../../sockets";
import { fileQueue } from "../../queues/queues";
import { logger } from "../../utils/logger";

export const filesController = {
  async presignUpload(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await filesService.presignUpload(req.user!.sub, req.body));
    } catch (err) {
      next(err);
    }
  },

  async completeUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const message = await filesService.completeUpload(req.user!.sub, req.body);

      // Broadcast to the room in real time
      getIO().to(req.body.roomId).emit("message:new", message);

      // Queue background processing (thumbnails, scanning, notifications)
      await fileQueue
        .add("process-file", { messageId: message.id, key: message.fileUrl })
        .catch((err) => logger.error(err, "failed to enqueue file job"));

      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  },

  async presignDownload(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await filesService.presignDownload(req.user!.sub, req.params.messageId!));
    } catch (err) {
      next(err);
    }
  },
};
