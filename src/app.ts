import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { roomsRouter } from "./modules/rooms/rooms.routes";
import { filesRouter } from "./modules/files/files.routes";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",") }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/files", filesRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
