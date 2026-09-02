import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { userSettings } from "../db/schema.js";

interface SettingsBody {
  dailyDigestEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

function getOrCreate(userId: string) {
  const existing = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  if (existing) return existing;
  db.insert(userSettings).values({ userId }).run();
  return db.select().from(userSettings).where(eq(userSettings.userId, userId)).get()!;
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    return getOrCreate(request.user.id);
  });

  app.patch<{ Body: SettingsBody }>("/api/settings", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    getOrCreate(request.user.id);
    const { dailyDigestEnabled, quietHoursStart, quietHoursEnd } = request.body;
    db.update(userSettings)
      .set({
        ...(dailyDigestEnabled !== undefined ? { dailyDigestEnabled } : {}),
        ...(quietHoursStart !== undefined ? { quietHoursStart } : {}),
        ...(quietHoursEnd !== undefined ? { quietHoursEnd } : {}),
      })
      .where(eq(userSettings.userId, request.user.id))
      .run();

    return db.select().from(userSettings).where(eq(userSettings.userId, request.user.id)).get();
  });
}
