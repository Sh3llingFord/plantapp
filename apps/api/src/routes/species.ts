import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { species } from "../db/schema.js";
import { searchIndex } from "../search/index.js";
import { saveUploadedPhoto } from "../uploads.js";

interface SpeciesQuery {
  q?: string;
  light?: string;
  hardy?: string;
  petsToxic?: string;
  indoor?: string;
  outdoor?: string;
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "true";
}

export async function speciesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: SpeciesQuery }>("/api/species", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const { q, light, hardy, petsToxic, indoor, outdoor } = request.query;

    const conditions = [];
    if (light) conditions.push(eq(species.light, light));
    const hardyBool = parseBool(hardy);
    if (hardyBool !== undefined) conditions.push(eq(species.hardy, hardyBool));
    const petsToxicBool = parseBool(petsToxic);
    if (petsToxicBool !== undefined) conditions.push(eq(species.petsToxic, petsToxicBool));
    const indoorBool = parseBool(indoor);
    if (indoorBool !== undefined) conditions.push(eq(species.indoor, indoorBool));
    const outdoorBool = parseBool(outdoor);
    if (outdoorBool !== undefined) conditions.push(eq(species.outdoor, outdoorBool));

    if (q) {
      const ids = searchIndex("species", q);
      if (ids.length === 0) return [];
      conditions.push(inArray(species.id, ids));
    }

    return db
      .select()
      .from(species)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .all();
  });

  app.get<{ Params: { id: string } }>("/api/species/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const entry = db.select().from(species).where(eq(species.id, request.params.id)).get();
    if (!entry) return reply.code(404).send({ error: "nicht gefunden" });
    return entry;
  });

  app.post<{ Params: { id: string } }>("/api/species/:id/photo", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const existing = db.select().from(species).where(eq(species.id, request.params.id)).get();
    if (!existing) return reply.code(404).send({ error: "nicht gefunden" });

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "keine Datei erhalten" });

    const photoPath = await saveUploadedPhoto(file, request.params.id);
    if (!photoPath) return reply.code(400).send({ error: "nur JPEG/PNG/WebP erlaubt" });

    db.update(species).set({ photoPath }).where(eq(species.id, request.params.id)).run();

    return { photoPath };
  });
}
