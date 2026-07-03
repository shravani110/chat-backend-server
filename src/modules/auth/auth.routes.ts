import { Router } from "express";
import { authController } from "./auth.controller";
import { validateBody } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { loginSchema, refreshSchema, registerSchema } from "./auth.types";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), authController.register);
authRouter.post("/login", validateBody(loginSchema), authController.login);
authRouter.post("/refresh", validateBody(refreshSchema), authController.refresh);
authRouter.get("/me", requireAuth, authController.me);
