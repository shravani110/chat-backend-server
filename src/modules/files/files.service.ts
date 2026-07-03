import crypto from "crypto";
import path from "path";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../../config/storage";
import { env } from "../../config/env";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import { roomsService } from "../rooms/rooms.service";
import { messagesService } from "../messages/messages.service";
import { prisma } from "../../config/prisma";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  CompleteUploadInput,
  PresignUploadInput,
} from "./files.types";

const UPLOAD_URL_TTL = 60 * 5; // 5 min to start the upload
const DOWNLOAD_URL_TTL = 60 * 15;

function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-() ]+/g, "_");
  return base.slice(0, 200) || "file";
}

export const filesService = {
  /**
   * Step 1: client asks for a presigned PUT URL, uploads the file
   * directly to storage (never through our server).
   */
  async presignUpload(userId: string, input: PresignUploadInput) {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new BadRequestError(`File type not allowed: ${input.mimeType}`);
    }
    await roomsService.assertMembership(userId, input.roomId);

    const safeName = sanitizeFileName(input.fileName);
    const key = `rooms/${input.roomId}/${crypto.randomUUID()}/${safeName}`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ContentType: input.mimeType,
        ContentLength: input.fileSize,
      }),
      { expiresIn: UPLOAD_URL_TTL }
    );

    return { uploadUrl, key, expiresIn: UPLOAD_URL_TTL };
  },

  /**
   * Step 2: after the client PUTs the file, verify it actually exists in
   * storage (HeadObject — trust nothing the client claims), then create
   * the FILE message.
   */
  async completeUpload(userId: string, input: CompleteUploadInput) {
    await roomsService.assertMembership(userId, input.roomId);
    if (!input.key.startsWith(`rooms/${input.roomId}/`)) {
      throw new BadRequestError("Key does not belong to this room");
    }

    let head;
    try {
      head = await s3.send(
        new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: input.key })
      );
    } catch {
      throw new BadRequestError("File not found in storage — upload it first");
    }

    const fileSize = head.ContentLength ?? 0;
    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      throw new BadRequestError("Uploaded file has an invalid size");
    }

    const message = await messagesService.createFileMessage(
      userId,
      input.roomId,
      {
        key: input.key,
        fileName: sanitizeFileName(path.basename(input.key)),
        fileSize,
        mimeType: head.ContentType ?? "application/octet-stream",
      },
      input.caption
    );
    return message;
  },

  /** Presigned GET URL for downloading a file message's attachment. */
  async presignDownload(userId: string, messageId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { roomId: true, fileUrl: true, fileName: true, deletedAt: true },
    });
    if (!message || !message.fileUrl || message.deletedAt) {
      throw new NotFoundError("File message not found");
    }
    await roomsService.assertMembership(userId, message.roomId);

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: message.fileUrl,
        ResponseContentDisposition: `attachment; filename="${message.fileName ?? "file"}"`,
      }),
      { expiresIn: DOWNLOAD_URL_TTL }
    );
    return { downloadUrl, expiresIn: DOWNLOAD_URL_TTL };
  },
};
