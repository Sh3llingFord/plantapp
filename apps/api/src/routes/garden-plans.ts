import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { gardenPlanCells, gardenPlans, species } from "../db/schema.js";

const MIN_SIZE = 2;
const MAX_SIZE = 30;

interface CreatePlanBody {
  name?: string;
  rows?: number;
  cols?: number;
}

interface RenamePlanBody {
  name?: string;
}

interface SetCellBody {
  row?: number;
  col?: number;
  speciesId?: string | null;
}

function validSize(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE;
}

/** Lädt einen Plan und stellt sicher, dass er dem eingeloggten Nutzer gehört — Beetpläne sind
 * als einzige Ressource der App pro Nutzer privat (siehe docs/ROADMAP.md, M7-Erweiterung). */
function getOwnPlanOr404(planId: string, userId: string) {
  return db
    .select()
    .from(gardenPlans)
    .where(and(eq(gardenPlans.id, planId), eq(gardenPlans.userId, userId)))
    .get();
}

export async function gardenPlanRoutes(app: FastifyInstance) {
  app.get("/api/garden-plans", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    return db.select().from(gardenPlans).where(eq(gardenPlans.userId, request.user.id)).all();
  });

  app.post<{ Body: CreatePlanBody }>("/api/garden-plans", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const { name, rows, cols } = request.body;
    if (!name || !name.trim()) return reply.code(400).send({ error: "name erforderlich" });
    if (!validSize(rows) || !validSize(cols)) {
      return reply.code(400).send({ error: `rows/cols müssen zwischen ${MIN_SIZE} und ${MAX_SIZE} liegen` });
    }

    const id = randomUUID();
    const now = new Date();
    db.insert(gardenPlans)
      .values({ id, userId: request.user.id, name: name.trim(), rows, cols, createdAt: now, updatedAt: now })
      .run();
    return db.select().from(gardenPlans).where(eq(gardenPlans.id, id)).get();
  });

  app.get<{ Params: { id: string } }>("/api/garden-plans/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const plan = getOwnPlanOr404(request.params.id, request.user.id);
    if (!plan) return reply.code(404).send({ error: "nicht gefunden" });

    const cells = db
      .select({
        row: gardenPlanCells.row,
        col: gardenPlanCells.col,
        speciesId: gardenPlanCells.speciesId,
        speciesBotanicalName: species.botanicalName,
        speciesCareProfile: species.careProfile,
        speciesPhotoPath: species.photoPath,
      })
      .from(gardenPlanCells)
      .innerJoin(species, eq(gardenPlanCells.speciesId, species.id))
      .where(eq(gardenPlanCells.planId, plan.id))
      .all();

    return { ...plan, cells };
  });

  app.patch<{ Params: { id: string }; Body: RenamePlanBody }>(
    "/api/garden-plans/:id",
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
      const plan = getOwnPlanOr404(request.params.id, request.user.id);
      if (!plan) return reply.code(404).send({ error: "nicht gefunden" });

      const { name } = request.body;
      if (!name || !name.trim()) return reply.code(400).send({ error: "name erforderlich" });

      db.update(gardenPlans)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(gardenPlans.id, plan.id))
        .run();
      return db.select().from(gardenPlans).where(eq(gardenPlans.id, plan.id)).get();
    },
  );

  app.put<{ Params: { id: string }; Body: SetCellBody }>(
    "/api/garden-plans/:id/cells",
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
      const plan = getOwnPlanOr404(request.params.id, request.user.id);
      if (!plan) return reply.code(404).send({ error: "nicht gefunden" });

      const { row, col, speciesId } = request.body;
      if (
        typeof row !== "number" ||
        typeof col !== "number" ||
        row < 0 ||
        col < 0 ||
        row >= plan.rows ||
        col >= plan.cols
      ) {
        return reply.code(400).send({ error: "row/col außerhalb des Rasters" });
      }

      db.delete(gardenPlanCells)
        .where(and(eq(gardenPlanCells.planId, plan.id), eq(gardenPlanCells.row, row), eq(gardenPlanCells.col, col)))
        .run();

      if (speciesId) {
        const speciesEntry = db.select({ id: species.id }).from(species).where(eq(species.id, speciesId)).get();
        if (!speciesEntry) return reply.code(400).send({ error: "unbekannte speciesId" });

        db.insert(gardenPlanCells)
          .values({ id: randomUUID(), planId: plan.id, row, col, speciesId, createdAt: new Date() })
          .run();
      }

      db.update(gardenPlans).set({ updatedAt: new Date() }).where(eq(gardenPlans.id, plan.id)).run();
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>("/api/garden-plans/:id", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const plan = getOwnPlanOr404(request.params.id, request.user.id);
    if (!plan) return reply.code(404).send({ error: "nicht gefunden" });

    db.delete(gardenPlans).where(eq(gardenPlans.id, plan.id)).run();
    return { ok: true };
  });
}
