import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { plants, taskOccurrences } from "../db/schema.js";
import { completeOccurrence, generateOccurrencesForAllPlants, TASK_TYPES, type TaskType } from "../tasks/generate.js";

interface TasksQuery {
  from?: string;
  to?: string;
  types?: string; // comma-separated TaskType[]
}

export async function taskRoutes(app: FastifyInstance) {
  app.get<{ Querystring: TasksQuery }>("/api/tasks", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const { from, to, types } = request.query;
    const conditions = [];
    if (from) conditions.push(gte(taskOccurrences.dueDate, new Date(from)));
    if (to) conditions.push(lte(taskOccurrences.dueDate, new Date(to)));
    if (types) {
      const list = types.split(",").filter((t): t is TaskType => TASK_TYPES.includes(t as TaskType));
      if (list.length > 0) conditions.push(inArray(taskOccurrences.type, list));
    }

    return db
      .select({
        id: taskOccurrences.id,
        plantId: taskOccurrences.plantId,
        type: taskOccurrences.type,
        dueDate: taskOccurrences.dueDate,
        status: taskOccurrences.status,
        completedDate: taskOccurrences.completedDate,
        plantNickname: plants.nickname,
        plantPhotoPath: plants.photoPath,
      })
      .from(taskOccurrences)
      .innerJoin(plants, eq(taskOccurrences.plantId, plants.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(taskOccurrences.dueDate))
      .all();
  });

  app.patch<{ Params: { id: string }; Body: { status: "done" | "skipped" | "later" } }>(
    "/api/tasks/:id",
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

      const { status } = request.body;
      if (status === "later") {
        const occurrence = db.select().from(taskOccurrences).where(eq(taskOccurrences.id, request.params.id)).get();
        if (!occurrence) return reply.code(404).send({ error: "nicht gefunden" });
        const nextDue = new Date(occurrence.dueDate);
        nextDue.setDate(nextDue.getDate() + 1);
        db.update(taskOccurrences).set({ dueDate: nextDue }).where(eq(taskOccurrences.id, occurrence.id)).run();
        return { ...occurrence, dueDate: nextDue };
      }

      const updated = completeOccurrence(request.params.id, status);
      if (!updated) return reply.code(404).send({ error: "nicht gefunden" });
      return { ok: true };
    },
  );

  // Manueller Anstoß, falls z.B. nach einem Server-Neustart mal etwas fehlt.
  app.post("/api/tasks/regenerate", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    generateOccurrencesForAllPlants();
    return { ok: true };
  });
}
