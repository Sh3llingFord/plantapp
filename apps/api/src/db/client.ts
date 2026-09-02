import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DB_PATH } from "./paths.js";
import * as schema from "./schema.js";

export const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
