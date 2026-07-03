import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { createRoomSchema } from "./rooms.types";
import { roomsController } from "./rooms.controller";

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

roomsRouter.post("/", validateBody(createRoomSchema), roomsController.create);
roomsRouter.get("/", roomsController.listMine);
roomsRouter.get("/:roomId/messages", roomsController.history);
