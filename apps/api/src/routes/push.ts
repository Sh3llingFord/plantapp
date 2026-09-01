import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { pushSubscriptions } from "../db/schema.js";
import { vapidKeys, webpush } from "../vapid.js";

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

    const subs = db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, request.user.id))
      .all();

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: "plantapp",
            body: "Testbenachrichtigung — Push funktioniert!",
          }),
        ),
      ),
    );

    const failedEndpoints = subs
      .filter((_, i) => results[i].status === "rejected")
      .map((s) => s.endpoint);

    for (const endpoint of failedEndpoints) {
      const result = results[subs.findIndex((s) => s.endpoint === endpoint)];
      if (
        result.status === "rejected" &&
        (result.reason?.statusCode === 404 || result.reason?.statusCode === 410)
      ) {
        db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
      }
    }

    return {
      sent: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  });
}
