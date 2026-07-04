import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { roomsRouter } from "./modules/rooms/rooms.routes";
import { filesRouter } from "./modules/files/files.routes";
import { usersRouter } from "./modules/users/users.routes";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";

export function createApp() {
  const app = express();

  // CSP disabled: the bundled demo frontend (public/index.html) uses inline JS
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",") }));
  app.use(express.json({ limit: "1mb" }));

  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/users", usersRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
