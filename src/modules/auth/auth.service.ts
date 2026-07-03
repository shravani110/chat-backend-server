import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ConflictError, UnauthorizedError } from "../../utils/errors";
import { JwtPayload, LoginInput, PublicUser, RegisterInput } from "./auth.types";

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
} as const;

function signTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { email: true },
    });
    if (existing) {
      throw new ConflictError(
        existing.email === input.email ? "Email already in use" : "Username taken"
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { email: input.email, username: input.username, passwordHash },
      select: PUBLIC_USER_SELECT,
    });

    return { user, ...signTokens({ sub: user.id, username: user.username }) };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // compare against a dummy hash on miss to keep timing uniform
    const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinval.invalid";
    const valid = await bcrypt.compare(input.password, hash);
    if (!user || !valid) throw new UnauthorizedError("Invalid credentials");

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
    return { user: publicUser, ...signTokens({ sub: user.id, username: user.username }) };
  },

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true },
    });
    if (!user) throw new UnauthorizedError("User no longer exists");
    return signTokens({ sub: user.id, username: user.username });
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new UnauthorizedError("User no longer exists");
    return user;
  },
};
