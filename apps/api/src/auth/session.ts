import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

export const SESSION_COOKIE_NAME = "plantapp_session";
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 Jahr — die installierte PWA soll sich nie ausloggen

export function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.insert(sessions).values({ id, userId, expiresAt, createdAt: now }).run();

  return { id, expiresAt };
}

export function getUserBySessionId(sessionId: string) {
  const row = db
    .select({
      id: users.id,
      username: users.username,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    deleteSession(sessionId);
    return null;
  }

  return { id: row.id, username: row.username };
}

export function deleteSession(sessionId: string) {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}
