import { and, eq, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { plants, taskOccurrences, userSettings, users } from "../db/schema.js";
import { TASK_LABELS, type TaskType } from "../tasks/generate.js";
import { sendPushToUser } from "./send.js";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function withinQuietHours(start: string, end: string): boolean {
  const now = currentTimeStr();
  return now >= start && now <= end;
}

function getOrCreateSettings(userId: string) {
  const existing = db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  if (existing) return existing;
  db.insert(userSettings).values({ userId }).run();
  return db.select().from(userSettings).where(eq(userSettings.userId, userId)).get()!;
}

function buildDigestMessage(
  tasks: { type: TaskType; plantNickname: string }[],
): { title: string; body: string; taskId?: string } {
  const types = new Set(tasks.map((t) => t.type));

  if (types.size === 1 && types.has("water")) {
    const names = tasks.map((t) => t.plantNickname);
    const body =
      tasks.length === 1
        ? `${names[0]} braucht heute Wasser.`
        : `${names.slice(0, 3).join(", ")}${tasks.length > 3 ? ` und ${tasks.length - 3} weitere` : ""} brauchen heute Wasser.`;
    return { title: "🌱 Gießen heute fällig", body };
  }

  const counts = new Map<TaskType, number>();
  for (const t of tasks) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  const parts = [...counts.entries()].map(([type, n]) => `${n}× ${TASK_LABELS[type].replace(/^\S+\s/, "")}`);
  return { title: "🌱 Heute fällig", body: parts.join(", ") };
}

async function runDigestForUser(userId: string) {
  const settings = getOrCreateSettings(userId);
  if (!settings.dailyDigestEnabled) return;
  if (settings.lastDigestSentDate === todayStr()) return;
  if (!withinQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) return;

  const dueTasks = db
    .select({
      id: taskOccurrences.id,
      type: taskOccurrences.type,
      plantNickname: plants.nickname,
    })
    .from(taskOccurrences)
    .innerJoin(plants, eq(taskOccurrences.plantId, plants.id))
    .where(and(eq(taskOccurrences.status, "pending"), lte(taskOccurrences.dueDate, new Date())))
    .all() as { id: string; type: TaskType; plantNickname: string }[];

  if (dueTasks.length > 0) {
    const message = buildDigestMessage(dueTasks);
    if (dueTasks.length === 1) message.taskId = dueTasks[0].id;
    await sendPushToUser(userId, message);
  }

  db.update(userSettings)
    .set({ lastDigestSentDate: todayStr() })
    .where(eq(userSettings.userId, userId))
    .run();
}

export async function runDigestCheck() {
  const allUsers = db.select({ id: users.id }).from(users).all();
  for (const u of allUsers) {
    await runDigestForUser(u.id);
  }
}
