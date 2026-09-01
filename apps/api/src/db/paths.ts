import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR =
  process.env.DATA_DIR ??
  (process.env.NODE_ENV === "production"
    ? "/data"
    : path.resolve(__dirname, "../../.data"));

fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, "plantapp.db");
