import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import type { MultipartFile } from "@fastify/multipart";
import { DATA_DIR } from "./db/paths.js";

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

// HEIC/HEIF (iPhone) bewusst blockiert: sharp/libvips unterstützt das Dekodieren
// in den meisten vorgefertigten Builds nicht zuverlässig. Für die vorhandenen
// Android-Handys unproblematisch, die JPEG aufnehmen. Ansonsten wird nicht auf
// eine exakte Liste erlaubter MIME-Types geprüft, da manche Android-Foto-Editoren
// beim Zuschneiden/Bearbeiten abweichende Typen wie "image/jpg" statt "image/jpeg"
// melden — stattdessen entscheidet sharp selbst per Versuch, ob es die Datei lesen kann.
const BLOCKED_MIME_TYPES = new Set(["image/heic", "image/heif"]);

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
  if (!file.mimetype.startsWith("image/") || BLOCKED_MIME_TYPES.has(file.mimetype)) return null;

  const input = await file.toBuffer();
  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate()
      // Zugeschnittene/bearbeitete Fotos aus Foto-Editoren sind gelegentlich PNG
      // mit Alphakanal — JPEG kennt keine Transparenz, also auf Weiß flatten,
      // statt dass die Konvertierung fehlschlägt oder unerwartet aussieht.
      .flatten({ background: "#ffffff" })
      .resize({
        width: MAX_DIMENSION_PX,
        height: MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch {
    // Datei war trotz image/*-MIME-Type für sharp nicht lesbar (beschädigt
    // oder ein von libvips nicht unterstütztes Format).
    return null;
  }

  const filename = `${prefix}-${randomUUID()}.jpg`;
  writeFileSync(path.join(UPLOADS_DIR, filename), output);
  return `/uploads/${filename}`;
}
