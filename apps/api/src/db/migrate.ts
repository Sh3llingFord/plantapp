import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

export function runMigrations() {
  migrate(db, { migrationsFolder });
}
