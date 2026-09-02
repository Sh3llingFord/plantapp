import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { CareProfileSchema, CARE_PROFILE_SCHEMA_VERSION } from "@plantapp/shared";
import { db } from "../db/client.js";
import { enrichmentJobs, plants } from "../db/schema.js";
import { getCachedCareProfile, storeEnrichmentResult, PROMPT_VERSION } from "../enrichment/cache.js";
import { signRequest, verifySignature } from "../enrichment/hmac.js";

const CALLBACK_PATH = "/api/enrichment/callback";

function callbackUrl(request: { protocol: string; hostname: string }): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}${CALLBACK_PATH}`;
  return `${request.protocol}://${request.hostname}${CALLBACK_PATH}`;
}

export async function enrichmentRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>("/api/plants/:id/enrich", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const plant = db.select().from(plants).where(eq(plants.id, request.params.id)).get();
    if (!plant) return reply.code(404).send({ error: "nicht gefunden" });

    const query = plant.freeTextSpecies ?? plant.nickname;

    // species_cache-Treffer: sofort verknüpfen, kein AI-Call nötig.
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
      app.log.error({ err }, "n8n-Webhook nicht erreichbar");
      // Job bleibt "queued" — Retry passiert nicht automatisch von unserer Seite,
      // n8n selbst retryt laut Roadmap serverseitig; der Job kann später erneut
      // über POST /api/plants/:id/enrich angestoßen werden.
    }

    return { status: "queued", jobId };
  });

  app.get<{ Params: { id: string } }>("/api/enrichment/jobs/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const job = db.select().from(enrichmentJobs).where(eq(enrichmentJobs.id, request.params.id)).get();
    if (!job) return reply.code(404).send({ error: "nicht gefunden" });
    return job;
  });

  // Kein Session-Auth: n8n authentifiziert sich per HMAC-Signatur über den rohen Body.
  app.post(CALLBACK_PATH, async (request, reply) => {
    const secret = process.env.N8N_CALLBACK_SECRET;
    const rawBody = request.rawBody;
    const timestamp = request.headers["x-plantapp-timestamp"] as string | undefined;
    const signature = request.headers["x-plantapp-signature"] as string | undefined;

    if (!secret || !rawBody || !verifySignature(secret, timestamp, signature, rawBody)) {
      return reply.code(401).send({ error: "ungültige Signatur" });
    }

    const body = request.body as {
      jobId?: string;
      error?: string;
      result?: unknown;
    };
    if (!body.jobId) return reply.code(400).send({ error: "jobId erforderlich" });

    const job = db.select().from(enrichmentJobs).where(eq(enrichmentJobs.id, body.jobId)).get();
    if (!job) return reply.code(404).send({ error: "job nicht gefunden" });

    const now = new Date();

    if (body.error) {
      db.update(enrichmentJobs)
        .set({ status: "failed", error: body.error, updatedAt: now })
        .where(eq(enrichmentJobs.id, job.id))
        .run();
      return { ok: true };
    }

    const parsed = CareProfileSchema.safeParse(body.result);
    if (!parsed.success) {
      db.update(enrichmentJobs)
        .set({ status: "failed", error: "Antwort entspricht nicht dem Schema", updatedAt: now })
        .where(eq(enrichmentJobs.id, job.id))
        .run();
      return reply.code(422).send({ error: "Antwort entspricht nicht dem CareProfile-Schema" });
    }

    const speciesId = storeEnrichmentResult(job.query, parsed.data);

    db.update(enrichmentJobs)
      .set({ status: "done", resultSpeciesId: speciesId, updatedAt: now })
      .where(eq(enrichmentJobs.id, job.id))
      .run();

    if (job.plantId) {
      db.update(plants).set({ speciesId }).where(eq(plants.id, job.plantId)).run();
    }

    return { ok: true };
  });
}
