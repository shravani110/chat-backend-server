# Chat Backend Server

Real-time chat & file sharing server. Node.js + Express + TypeScript, PostgreSQL (Prisma), Socket.io, S3-compatible storage (Supabase Storage / Cloudflare R2), Redis + BullMQ workers.

## Setup

1. Copy `.env.example` to `.env` and fill in real values:
   - `DATABASE_URL` — Supabase / Neon / local Postgres
   - `REDIS_URL` — Upstash / local Redis
   - `S3_*` — Supabase Storage S3 credentials or Cloudflare R2
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` — random 32+ char strings
2. Install and migrate:
   ```bash
   npm install
   npx prisma migrate dev --name init
   ```
3. Run:
   ```bash
   npm run dev         # API + Socket.io on :4000
   npm run worker:dev  # BullMQ workers (separate terminal)
   ```

## REST API

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | `{email, username, password}` → user + tokens |
| POST | `/api/auth/login` | `{email, password}` → user + tokens |
| POST | `/api/auth/refresh` | `{refreshToken}` → new token pair |
| GET | `/api/auth/me` | Current user (Bearer token) |
| POST | `/api/rooms` | `{name?, type: DIRECT\|GROUP, participantIds[]}` |
| GET | `/api/rooms` | My rooms with last-message preview |
| GET | `/api/rooms/:roomId/messages?cursor=&limit=` | Paginated history |
| POST | `/api/files/presign` | `{roomId, fileName, mimeType, fileSize}` → presigned PUT URL |
| POST | `/api/files/complete` | `{roomId, key, caption?}` → FILE message (verifies object) |
| GET | `/api/files/:messageId/download` | Presigned download URL |

File upload flow: `presign` → client PUTs file to `uploadUrl` → `complete` → server verifies via HeadObject, creates message, broadcasts `message:new`, queues background processing.

## Socket.io

Connect with `io(url, { auth: { token: accessToken } })`. On connect the server joins you to all your rooms automatically.

Client → server: `message:send` (with ack), `message:read`, `typing:start/stop`, `presence:who`.
Server → client: `message:new`, `presence:online/offline`, `typing:start/stop`.

Presence is Redis-backed (per-user connection counting), multi-instance safe.

## Deployment (Render)

`render.yaml` defines a Docker web service (API) and a worker service sharing the same image. Provision Postgres/Redis/storage on their free tiers and set the `sync: false` env vars in the Render dashboard. The container runs `prisma migrate deploy` on boot.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run worker:dev` / `npm run worker`
- `npm run prisma:migrate` / `prisma:deploy` / `prisma:generate`
- `npm run typecheck`
