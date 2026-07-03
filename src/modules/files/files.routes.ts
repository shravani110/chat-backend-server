import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { completeUploadSchema, presignUploadSchema } from "./files.types";
import { filesController } from "./files.controller";

export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.post("/presign", validateBody(presignUploadSchema), filesController.presignUpload);
filesRouter.post("/complete", validateBody(completeUploadSchema), filesController.completeUpload);
filesRouter.get("/:messageId/download", filesController.presignDownload);
