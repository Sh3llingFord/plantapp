import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { locations } from "../db/schema.js";

interface LocationBody {
  name?: string;
  direction?: string | null;
  indoor?: boolean;
  lightEstimate?: string | null;
}

export async function locationRoutes(app: FastifyInstance) {
  app.get("/api/locations", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    return db.select().from(locations).all();
  });

  app.post<{ Body: LocationBody }>("/api/locations", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const { name, direction, indoor, lightEstimate } = request.body;
    if (!name || indoor === undefined) {
      return reply.code(400).send({ error: "name und indoor erforderlich" });
    }

    const id = randomUUID();
    db.insert(locations)
      .values({
        id,
        name,
        direction: direction ?? null,
        indoor,
        lightEstimate: lightEstimate ?? null,
        createdAt: new Date(),
      })
      .run();
    return db.select().from(locations).where(eq(locations.id, id)).get();
  });

  app.patch<{ Params: { id: string }; Body: LocationBody }>(
    "/api/locations/:id",
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
      const existing = db.select().from(locations).where(eq(locations.id, request.params.id)).get();
      if (!existing) return reply.code(404).send({ error: "nicht gefunden" });

      const { name, direction, indoor, lightEstimate } = request.body;
      db.update(locations)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(direction !== undefined ? { direction } : {}),
          ...(indoor !== undefined ? { indoor } : {}),
          ...(lightEstimate !== undefined ? { lightEstimate } : {}),
        })
        .where(eq(locations.id, request.params.id))
        .run();
      return db.select().from(locations).where(eq(locations.id, request.params.id)).get();
    },
  );

  app.delete<{ Params: { id: string } }>("/api/locations/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    db.delete(locations).where(eq(locations.id, request.params.id)).run();
    return { ok: true };
  });
}
