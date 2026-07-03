import { z } from "zod";

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "video/mp4",
  "audio/mpeg",
  "audio/ogg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const presignUploadSchema = z.object({
  roomId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

export const completeUploadSchema = z.object({
  roomId: z.string().uuid(),
  key: z.string().min(1),
  caption: z.string().max(1000).optional(),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
