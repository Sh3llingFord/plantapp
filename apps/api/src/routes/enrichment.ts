import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { CareProfileSchema } from "@plantapp/shared";
import { db } from "../db/client.js";
import { enrichmentJobs, plants } from "../db/schema.js";
import { storeEnrichmentResult } from "../enrichment/cache.js";
import { verifySignature } from "../enrichment/hmac.js";
import { triggerEnrichmentForPlant, CALLBACK_PATH } from "../enrichment/trigger.js";
import { generateOccurrencesForPlant } from "../tasks/generate.js";

export async function enrichmentRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>("/api/plants/:id/enrich", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const plant = db.select().from(plants).where(eq(plants.id, request.params.id)).get();
    if (!plant) return reply.code(404).send({ error: "nicht gefunden" });

    const result = await triggerEnrichmentForPlant(plant, request, app.log);
    if (result.status === "skipped") {
      return reply
        .code(400)
        .send({ error: "kein Artname hinterlegt — erst bearbeiten und einen eintragen" });
    }
    return result;
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
      const plant = db.select().from(plants).where(eq(plants.id, job.plantId)).get();
      if (plant) generateOccurrencesForPlant(plant);
    }

    return { ok: true };
  });
}
