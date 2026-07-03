import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../utils/errors";
import { JwtPayload } from "../modules/auth/auth.types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing access token"));
  }
  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}
