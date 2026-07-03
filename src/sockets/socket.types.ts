import { Socket, Server } from "socket.io";
import { JwtPayload } from "../modules/auth/auth.types";

export interface ServerToClientEvents {
  "message:new": (message: unknown) => void;
  "room:joined": (data: { roomId: string; userId: string }) => void;
  "presence:online": (data: { userId: string }) => void;
  "presence:offline": (data: { userId: string; lastSeenAt: string }) => void;
  "typing:start": (data: { roomId: string; userId: string; username: string }) => void;
  "typing:stop": (data: { roomId: string; userId: string }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "message:send": (
    data: { roomId: string; content: string },
    ack?: (res: { ok: boolean; message?: unknown; error?: string }) => void
  ) => void;
  "message:read": (data: { roomId: string }) => void;
  "typing:start": (data: { roomId: string }) => void;
  "typing:stop": (data: { roomId: string }) => void;
  "presence:who": (
    data: { userIds: string[] },
    ack: (res: { online: string[] }) => void
  ) => void;
}

export interface SocketData {
  user: JwtPayload;
}

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
