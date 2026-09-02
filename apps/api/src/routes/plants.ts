import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { mergeCareProfile, type CareProfile } from "@plantapp/shared";
import { db } from "../db/client.js";
import { enrichmentJobs, plants, species } from "../db/schema.js";
import { indexPlant, removeFromIndex, searchIndex } from "../search/index.js";
import { saveUploadedPhoto } from "../uploads.js";
import { triggerEnrichmentForPlant } from "../enrichment/trigger.js";

interface PlantsQuery {
  q?: string;
  locationId?: string;
}

interface PlantBody {
  nickname?: string;
  speciesId?: string | null;
  freeTextSpecies?: string | null;
  locationId?: string | null;
  purchaseDate?: string | null; // ISO date
  notes?: string | null;
  careProfileOverrides?: Partial<CareProfile> | null;
}

export async function plantRoutes(app: FastifyInstance) {
  app.get<{ Querystring: PlantsQuery }>("/api/plants", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const { q, locationId } = request.query;
    const conditions = [];
    if (locationId) conditions.push(eq(plants.locationId, locationId));
    if (q) {
      const ids = searchIndex("plant", q);
      if (ids.length === 0) return [];
      conditions.push(inArray(plants.id, ids));
    }

    return db
      .select({
        id: plants.id,
        nickname: plants.nickname,
        speciesId: plants.speciesId,
        freeTextSpecies: plants.freeTextSpecies,
        locationId: plants.locationId,
        purchaseDate: plants.purchaseDate,
        notes: plants.notes,
        photoPath: plants.photoPath,
        createdAt: plants.createdAt,
        speciesBotanicalName: species.botanicalName,
        speciesCareProfile: species.careProfile,
      })
      .from(plants)
      .leftJoin(species, eq(plants.speciesId, species.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .all();
  });

  app.get<{ Params: { id: string } }>("/api/plants/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const plant = db.select().from(plants).where(eq(plants.id, request.params.id)).get();
    if (!plant) return reply.code(404).send({ error: "nicht gefunden" });

    let careProfile: CareProfile | null = null;
    if (plant.speciesId) {
      const speciesEntry = db.select().from(species).where(eq(species.id, plant.speciesId)).get();
      if (speciesEntry) {
        careProfile = mergeCareProfile(
          speciesEntry.careProfile as CareProfile,
          plant.careProfileOverrides as Partial<CareProfile> | null,
        );
      }
    }

    const latestJob = db
      .select({ id: enrichmentJobs.id, status: enrichmentJobs.status, error: enrichmentJobs.error })
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.plantId, plant.id))
      .orderBy(desc(enrichmentJobs.createdAt))
      .limit(1)
      .get();

    return { ...plant, careProfile, latestEnrichmentJob: latestJob ?? null };
  });

  app.post<{ Body: PlantBody }>("/api/plants", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const { nickname, speciesId, freeTextSpecies, locationId, purchaseDate, notes } =
      request.body;
    if (!nickname) return reply.code(400).send({ error: "nickname erforderlich" });

    const id = randomUUID();
    db.insert(plants)
      .values({
        id,
        nickname,
        speciesId: speciesId ?? null,
        freeTextSpecies: freeTextSpecies ?? null,
        locationId: locationId ?? null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        notes: notes ?? null,
        createdAt: new Date(),
      })
      .run();

    indexPlant(id, nickname, freeTextSpecies ?? null, notes ?? null);

    const created = db.select().from(plants).where(eq(plants.id, id)).get()!;

    // Frei eingetragene Art (nicht aus dem Katalog) -> KI-Recherche automatisch
    // anstoßen. Läuft asynchron im Hintergrund, blockiert die Antwort nicht.
    if (!created.speciesId && created.freeTextSpecies) {
      triggerEnrichmentForPlant(created, request, app.log).catch((err) => {
        app.log.error({ err }, "Automatische KI-Recherche fehlgeschlagen");
      });
    }

    return created;
  });

  app.patch<{ Params: { id: string }; Body: PlantBody }>(
    "/api/plants/:id",
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

      const existing = db.select().from(plants).where(eq(plants.id, request.params.id)).get();
      if (!existing) return reply.code(404).send({ error: "nicht gefunden" });

      const { nickname, speciesId, freeTextSpecies, locationId, purchaseDate, notes, careProfileOverrides } =
        request.body;

      db.update(plants)
        .set({
          ...(nickname !== undefined ? { nickname } : {}),
          ...(speciesId !== undefined ? { speciesId } : {}),
          ...(freeTextSpecies !== undefined ? { freeTextSpecies } : {}),
          ...(locationId !== undefined ? { locationId } : {}),
          ...(purchaseDate !== undefined
            ? { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }
            : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(careProfileOverrides !== undefined ? { careProfileOverrides } : {}),
        })
        .where(eq(plants.id, request.params.id))
        .run();

      const updated = db.select().from(plants).where(eq(plants.id, request.params.id)).get()!;
      indexPlant(updated.id, updated.nickname, updated.freeTextSpecies, updated.notes);

      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>("/api/plants/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    db.delete(plants).where(eq(plants.id, request.params.id)).run();
    removeFromIndex("plant", request.params.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/plants/:id/photo", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const existing = db.select().from(plants).where(eq(plants.id, request.params.id)).get();
    if (!existing) return reply.code(404).send({ error: "nicht gefunden" });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "keine Datei erhalten" });

    const photoPath = await saveUploadedPhoto(file, request.params.id);
    if (!photoPath) return reply.code(400).send({ error: "nur JPEG/PNG/WebP erlaubt" });

    db.update(plants).set({ photoPath }).where(eq(plants.id, request.params.id)).run();

    return { photoPath };
  });
}
