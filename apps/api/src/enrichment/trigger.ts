import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { CARE_PROFILE_SCHEMA_VERSION } from "@plantapp/shared";
import { db } from "../db/client.js";
import { enrichmentJobs, plants, type plants as PlantsTable } from "../db/schema.js";
import { getCachedCareProfile, storeEnrichmentResult, PROMPT_VERSION } from "./cache.js";
import { signRequest } from "./hmac.js";

export const CALLBACK_PATH = "/api/enrichment/callback";

export function callbackUrl(request: { protocol: string; hostname: string }): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}${CALLBACK_PATH}`;
  return `${request.protocol}://${request.hostname}${CALLBACK_PATH}`;
}

type Plant = typeof PlantsTable.$inferSelect;

export type TriggerResult =
  | { status: "done"; speciesId: string }
  | { status: "queued"; jobId: string; note?: string }
  | { status: "skipped" };

/**
 * Stößt die KI-Recherche für eine Pflanze an: Katalogtreffer sofort, sonst
 * asynchroner n8n-Job. Sucht ausschließlich über plant.freeTextSpecies —
 * der Spitzname (nickname) ist kein Artname und wird nie als Suchbegriff
 * verwendet, da er z.B. ein Kosename sein kann.
 */
export async function triggerEnrichmentForPlant(
  plant: Plant,
  request: { protocol: string; hostname: string },
  log: { error: (obj: unknown, msg: string) => void },
): Promise<TriggerResult> {
  const query = plant.freeTextSpecies;
  if (!query || !query.trim()) return { status: "skipped" };

  const cached = getCachedCareProfile(query);
  if (cached) {
    const speciesId = storeEnrichmentResult(query, cached);
    db.update(plants).set({ speciesId }).where(eq(plants.id, plant.id)).run();
    return { status: "done", speciesId };
  }

  const jobId = randomUUID();
  const now = new Date();
  db.insert(enrichmentJobs)
    .values({ id: jobId, query, plantId: plant.id, status: "queued", createdAt: now, updatedAt: now })
    .run();

  const webhookUrl = process.env.N8N_ENRICH_WEBHOOK_URL;
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!webhookUrl || !secret) {
    // n8n ist (noch) nicht angebunden — die Pflanze bleibt trotzdem nutzbar,
    // der Job bleibt "queued", bis n8n konfiguriert ist. Die KI darf nie ein Blocker sein.
    return { status: "queued", jobId, note: "n8n-Webhook nicht konfiguriert" };
  }

  const payload = {
    jobId,
    query,
    locale: "de",
    hardinessZone: null,
    callbackUrl: callbackUrl(request),
    schemaVersion: CARE_PROFILE_SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
  };
  const rawBody = JSON.stringify(payload);
  const { timestamp, signature } = signRequest(secret, rawBody);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Plantapp-Timestamp": timestamp,
        "X-Plantapp-Signature": signature,
      },
      body: rawBody,
    });
  } catch (err) {
    log.error({ err }, "n8n-Webhook nicht erreichbar");
    // Job bleibt "queued" — kann später erneut über POST /api/plants/:id/enrich
    // angestoßen werden.
  }

  return { status: "queued", jobId };
}
