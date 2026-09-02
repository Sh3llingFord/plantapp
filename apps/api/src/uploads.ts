import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import type { MultipartFile } from "@fastify/multipart";
import { DATA_DIR } from "./db/paths.js";

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

// HEIC/HEIF (iPhone) bewusst nicht gelistet: sharp/libvips unterstützt das
// Dekodieren in den meisten vorgefertigten Builds nicht zuverlässig. Für die
// vorhandenen Android-Handys unproblematisch, die JPEG aufnehmen.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Handy-Fotos sind oft mehrere MB groß und tragen eine EXIF-Rotation statt
// gedrehter Pixel — das führt je nach Anzeigekontext zu falscher Ausrichtung
// und lässt /data unnötig wachsen. Deshalb wird jedes Foto serverseitig auf
// eine sinnvolle Größe verkleinert, die Rotation fest in die Pixel gebacken
// (sharp().rotate() ohne Argumente liest die EXIF-Orientierung) und
// einheitlich als JPEG re-encodiert.
const MAX_DIMENSION_PX = 1600;
const JPEG_QUALITY = 82;

export async function saveUploadedPhoto(
  file: MultipartFile,
  prefix: string,
): Promise<string | null> {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return null;

  const input = await file.toBuffer();
  const output = await sharp(input)
    .rotate()
    .resize({
      width: MAX_DIMENSION_PX,
      height: MAX_DIMENSION_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const filename = `${prefix}-${randomUUID()}.jpg`;
  writeFileSync(path.join(UPLOADS_DIR, filename), output);
  return `/uploads/${filename}`;
}
