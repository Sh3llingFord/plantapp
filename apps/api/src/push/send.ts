import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { pushSubscriptions } from "../db/schema.js";
import { webpush } from "../vapid.js";

export interface PushPayload {
  title: string;
  body: string;
  taskId?: string;
}

/** Sendet an alle Subscriptions eines Nutzers, räumt bei 404/410 (abgelaufen) auf. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const subs = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ),
    ),
  );

  results.forEach((result, i) => {
    if (
      result.status === "rejected" &&
      (result.reason?.statusCode === 404 || result.reason?.statusCode === 410)
    ) {
      db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subs[i].endpoint)).run();
    }
  });

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
