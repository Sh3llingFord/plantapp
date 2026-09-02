import { randomUUID } from "node:crypto";
import path from "node:path";
import { createWriteStream, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { MultipartFile } from "@fastify/multipart";
import { DATA_DIR } from "./db/paths.js";

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function saveUploadedPhoto(
  file: MultipartFile,
  prefix: string,
): Promise<string | null> {
  const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
  if (!ext) return null;

  const filename = `${prefix}-${randomUUID()}${ext}`;
  await pipeline(file.file, createWriteStream(path.join(UPLOADS_DIR, filename)));
  return `/uploads/${filename}`;
}
