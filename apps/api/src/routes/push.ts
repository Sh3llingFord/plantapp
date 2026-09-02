import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { pushSubscriptions } from "../db/schema.js";
import { vapidKeys } from "../vapid.js";
import { sendPushToUser } from "../push/send.js";

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function pushRoutes(app: FastifyInstance) {
  app.get("/api/push/public-key", async () => {
    return { publicKey: vapidKeys.publicKey };
  });

  app.post<{ Body: SubscribeBody }>("/api/push/subscribe", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const { endpoint, keys } = request.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return reply.code(400).send({ error: "ungültiges Subscription-Objekt" });
    }

    db.insert(pushSubscriptions)
      .values({
        userId: request.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: keys.p256dh, auth: keys.auth },
      })
      .run();

    return { ok: true };
  });

  app.post("/api/push/test", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    return sendPushToUser(request.user.id, {
      title: "Plants vs. Mella",
      body: "Testbenachrichtigung — Push funktioniert!",
    });
  });
}
