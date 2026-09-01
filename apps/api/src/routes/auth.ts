import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { verifyPassword } from "../auth/password.js";
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "../auth/session.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email?: string; password?: string } }>(
    "/api/auth/login",
    async (request, reply) => {
      const { email, password } = request.body ?? {};
      if (!email || !password) {
        return reply.code(400).send({ error: "email und password erforderlich" });
      }

      const user = db.select().from(users).where(eq(users.email, email)).get();
      if (!user || !(await verifyPassword(user.passwordHash, password))) {
        return reply.code(401).send({ error: "ungültige Zugangsdaten" });
      }

      const session = createSession(user.id);
      reply.setCookie(SESSION_COOKIE_NAME, session.id, {
        ...COOKIE_OPTIONS,
        expires: session.expiresAt,
      });

      return { email: user.email };
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
    return { email: request.user.email };
  });
}
