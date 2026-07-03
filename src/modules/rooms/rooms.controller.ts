import { NextFunction, Request, Response } from "express";
import { roomsService } from "./rooms.service";
import { messagesService } from "../messages/messages.service";

export const roomsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await roomsService.createRoom(req.user!.sub, req.body));
    } catch (err) {
      next(err);
    }
  },

  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await roomsService.listMyRooms(req.user!.sub));
    } catch (err) {
      next(err);
    }
  },

  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const limit = Number(req.query.limit) || 50;
      res.json(
        await messagesService.getHistory(req.user!.sub, req.params.roomId!, cursor, limit)
      );
    } catch (err) {
      next(err);
    }
  },
};
