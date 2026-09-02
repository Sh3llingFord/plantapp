import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { calendarTokens, plants, taskOccurrences } from "../db/schema.js";
import { TASK_LABELS, type TaskType } from "../tasks/generate.js";

function icsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export async function calendarRoutes(app: FastifyInstance) {
  app.get("/api/calendar/token", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });

    const existing = db
      .select()
      .from(calendarTokens)
      .where(eq(calendarTokens.userId, request.user.id))
      .get();
    if (existing) return { token: existing.token };

    const token = randomUUID().replace(/-/g, "");
    db.insert(calendarTokens).values({ token, userId: request.user.id, createdAt: new Date() }).run();
    return { token };
  });

  app.get<{ Querystring: { token?: string } }>("/api/calendar/feed.ics", async (request, reply) => {
    const token = request.query.token;
    if (!token) return reply.code(401).send({ error: "token erforderlich" });

    const tokenRow = db.select().from(calendarTokens).where(eq(calendarTokens.token, token)).get();
    if (!tokenRow) return reply.code(401).send({ error: "ungültiger token" });

    const rows = db
      .select({
        id: taskOccurrences.id,
        type: taskOccurrences.type,
        dueDate: taskOccurrences.dueDate,
        status: taskOccurrences.status,
        nickname: plants.nickname,
      })
      .from(taskOccurrences)
      .innerJoin(plants, eq(taskOccurrences.plantId, plants.id))
      .where(eq(taskOccurrences.status, "pending"))
      .all();

    const now = icsDate(new Date());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//plantapp//Pflegekalender//DE",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Plants vs. Mella",
    ];

    for (const row of rows) {
      const label = TASK_LABELS[row.type as TaskType] ?? row.type;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${row.id}@plantapp`,
        `DTSTAMP:${now}T000000Z`,
        `DTSTART;VALUE=DATE:${icsDate(row.dueDate)}`,
        `SUMMARY:${escapeIcsText(`${label} — ${row.nickname}`)}`,
        "END:VEVENT",
      );
    }

    lines.push("END:VCALENDAR");

    reply.header("Content-Type", "text/calendar; charset=utf-8");
    return lines.join("\r\n");
  });
}
