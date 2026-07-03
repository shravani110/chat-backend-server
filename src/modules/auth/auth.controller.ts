import { NextFunction, Request, Response } from "express";
import { authService } from "./auth.service";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await authService.register(req.body));
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await authService.login(req.body));
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await authService.refresh(req.body.refreshToken));
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await authService.me(req.user!.sub));
    } catch (err) {
      next(err);
    }
  },
};
