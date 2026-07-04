import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { prisma } from "../../config/prisma";

export const usersRouter = Router();
usersRouter.use(requireAuth);

// GET /api/users/search?q=ali — find users by username prefix (for starting chats)
usersRouter.get("/search", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) return res.json([]);
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: "insensitive" },
        id: { not: req.user!.sub },
      },
      select: { id: true, username: true, avatarUrl: true },
      take: 10,
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});
