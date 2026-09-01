import { randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "../auth/session.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

function setupCodeMatches(candidate: string): boolean {
  const expected = process.env.PLANTAPP_SETUP_CODE;
  if (!expected) return false; // ohne konfigurierten Code ist Registrierung deaktiviert

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // Buffer-Längen müssen für timingSafeEqual übereinstimmen; ungleiche Länge ist ohnehin falsch.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { username?: string; password?: string; setupCode?: string } }>(
    "/api/auth/register",
    async (request, reply) => {
      const { username, password, setupCode } = request.body ?? {};
      if (!username || !password || !setupCode) {
        return reply
          .code(400)
          .send({ error: "username, password und setupCode erforderlich" });
      }
      if (!setupCodeMatches(setupCode)) {
        return reply.code(403).send({ error: "ungültiger Setup-Code" });
      }
      if (password.length < 8) {
        return reply.code(400).send({ error: "Passwort muss mindestens 8 Zeichen haben" });
      }

      const existing = db.select().from(users).where(eq(users.username, username)).get();
      if (existing) {
        return reply.code(409).send({ error: "Benutzername bereits vergeben" });
      }

      const passwordHash = await hashPassword(password);
      const id = randomUUID();
      db.insert(users).values({ id, username, passwordHash, createdAt: new Date() }).run();

      const session = createSession(id);
      reply.setCookie(SESSION_COOKIE_NAME, session.id, {
        ...COOKIE_OPTIONS,
        expires: session.expiresAt,
      });

      return { username };
    },
  );

  app.post<{ Body: { username?: string; password?: string } }>(
    "/api/auth/login",
    async (request, reply) => {
      const { username, password } = request.body ?? {};
      if (!username || !password) {
        return reply.code(400).send({ error: "username und password erforderlich" });
      }

      const user = db.select().from(users).where(eq(users.username, username)).get();
      if (!user || !(await verifyPassword(user.passwordHash, password))) {
        return reply.code(401).send({ error: "ungültige Zugangsdaten" });
      }

      const session = createSession(user.id);
      reply.setCookie(SESSION_COOKIE_NAME, session.id, {
        ...COOKIE_OPTIONS,
        expires: session.expiresAt,
      });

      return { username: user.username };
    },
  );

  app.post("/api/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE_NAME];
    if (sessionId) deleteSession(sessionId);
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    return { username: request.user.username };
  });
}
