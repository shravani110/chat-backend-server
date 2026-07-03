import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  logger.error(err, "Unhandled error");
  return res.status(500).json({ error: "Internal server error" });
}

export function notFoundMiddleware(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}
