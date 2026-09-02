import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { mergeCareProfile, type CareProfile } from "@plantapp/shared";
import { db } from "../db/client.js";
import { plants, species, taskOccurrences } from "../db/schema.js";

export const TASK_TYPES = [
  "water",
  "fertilize",
  "prune",
  "repot",
  "harvest",
  "winter_protect_in",
  "winter_protect_out",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_LABELS: Record<TaskType, string> = {
  water: "💧 Gießen",
  fertilize: "🌱 Düngen",
  prune: "✂️ Schnitt",
  repot: "🔄 Umtopfen",
  harvest: "🧺 Ernte",
  winter_protect_in: "🥶 Winterschutz (reinholen)",
  winter_protect_out: "☀️ Winterschutz (rausstellen)",
};

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function seasonForMonth(monthIndex: number): "spring" | "summer" | "autumn" | "winter" {
  if ([2, 3, 4].includes(monthIndex)) return "spring";
  if ([5, 6, 7].includes(monthIndex)) return "summer";
  if ([8, 9, 10].includes(monthIndex)) return "autumn";
  return "winter";
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Nächster Monat (ab heute, inkl.) aus einer Liste deutscher Monatsnamen, als Datum am 1. dieses Monats. */
function nextDateInMonthList(from: Date, monthNames: string[] | null | undefined): Date | null {
  if (!monthNames || monthNames.length === 0) return null;
  const wanted = new Set(
    monthNames.map((m) => MONTHS_DE.findIndex((n) => n.toLowerCase() === m.toLowerCase())).filter((i) => i >= 0),
  );
  if (wanted.size === 0) return null;

  for (let offset = 0; offset < 12; offset++) {
    const candidateMonth = (from.getMonth() + offset) % 12;
    const candidateYear = from.getFullYear() + Math.floor((from.getMonth() + offset) / 12);
    if (wanted.has(candidateMonth)) {
      const candidate = new Date(candidateYear, candidateMonth, 1);
      if (candidate >= startOfDay(from)) return candidate;
    }
  }
  return null;
}

function getMergedCareProfile(plant: typeof plants.$inferSelect): CareProfile | null {
  if (!plant.speciesId) return null;
  const speciesEntry = db.select().from(species).where(eq(species.id, plant.speciesId)).get();
  if (!speciesEntry) return null;
  return mergeCareProfile(
    speciesEntry.careProfile as CareProfile,
    plant.careProfileOverrides as Partial<CareProfile> | null,
  );
}

function hasPending(plantId: string, type: TaskType): boolean {
  return !!db
    .select({ id: taskOccurrences.id })
    .from(taskOccurrences)
    .where(and(eq(taskOccurrences.plantId, plantId), eq(taskOccurrences.type, type), eq(taskOccurrences.status, "pending")))
    .get();
}

function lastCompletedDate(plantId: string, type: TaskType): Date | null {
  const row = db
    .select({ completedDate: taskOccurrences.completedDate })
    .from(taskOccurrences)
    .where(and(eq(taskOccurrences.plantId, plantId), eq(taskOccurrences.type, type), eq(taskOccurrences.status, "done")))
    .orderBy(desc(taskOccurrences.completedDate))
    .limit(1)
    .get();
  return row?.completedDate ?? null;
}

function insertOccurrence(plantId: string, type: TaskType, dueDate: Date) {
  db.insert(taskOccurrences)
    .values({ id: randomUUID(), plantId, type, dueDate, status: "pending", createdAt: new Date() })
    .run();
}

/**
 * Sorgt dafür, dass für eine Pflanze alle anwendbaren Aufgabentypen eine
 * "pending"-Fälligkeit haben (falls das Pflegeprofil dafür Daten hergibt).
 * Idempotent — legt nichts doppelt an.
 */
export function generateOccurrencesForPlant(plant: typeof plants.$inferSelect, today: Date = new Date()) {
  const care = getMergedCareProfile(plant);
  if (!care) return;

  const anchorBase = plant.purchaseDate ?? plant.createdAt;

  // Gießen: Intervall hängt von der Jahreszeit des letzten (tatsächlichen)
  // Gießdatums ab, nicht vom ursprünglichen Plandatum.
  if (care.water?.intervalDaysBySeason && !hasPending(plant.id, "water")) {
    const anchor = lastCompletedDate(plant.id, "water") ?? anchorBase;
    const season = seasonForMonth(anchor.getMonth());
    const interval = care.water.intervalDaysBySeason[season];
    if (interval && interval > 0) {
      let due = addDays(anchor, interval);
      if (due < startOfDay(today)) due = startOfDay(today); // keine Fälligkeiten in der Vergangenheit neu anlegen
      insertOccurrence(plant.id, "water", due);
    }
  }

  // Düngen: nächster Monat im Saisonfenster (grobe Näherung, da "rhythm" Freitext ist).
  if (care.fertilizer?.seasonWindow && !hasPending(plant.id, "fertilize")) {
    const anchor = lastCompletedDate(plant.id, "fertilize") ?? today;
    const due = nextDateInMonthList(addDays(anchor, 1), care.fertilizer.seasonWindow);
    if (due) insertOccurrence(plant.id, "fertilize", due);
  }

  // Schnitt: nächstes Schnittfenster (alle windows zusammengefasst).
  if (care.pruning?.windows && care.pruning.windows.length > 0 && !hasPending(plant.id, "prune")) {
    const anchor = lastCompletedDate(plant.id, "prune") ?? today;
    const allMonths = care.pruning.windows.flatMap((w) => w.months);
    const due = nextDateInMonthList(addDays(anchor, 1), allMonths);
    if (due) insertOccurrence(plant.id, "prune", due);
  }

  // Umtopfen: alle X Jahre, im ersten bestMonth.
  if (care.repotting?.everyYears && care.repotting.everyYears > 0 && !hasPending(plant.id, "repot")) {
    const lastRepot = lastCompletedDate(plant.id, "repot") ?? anchorBase;
    const targetMonth = care.repotting.bestMonths?.length
      ? MONTHS_DE.findIndex((n) => n.toLowerCase() === care.repotting!.bestMonths![0].toLowerCase())
      : lastRepot.getMonth();
    let due = new Date(lastRepot.getFullYear() + care.repotting.everyYears, targetMonth >= 0 ? targetMonth : lastRepot.getMonth(), 1);
    while (due < startOfDay(today)) due = new Date(due.getFullYear() + care.repotting!.everyYears!, due.getMonth(), 1);
    insertOccurrence(plant.id, "repot", due);
  }

  // Ernte: nächster Monat im Erntefenster.
  if (care.harvest?.months && !hasPending(plant.id, "harvest")) {
    const anchor = lastCompletedDate(plant.id, "harvest") ?? today;
    const due = nextDateInMonthList(addDays(anchor, 1), care.harvest.months);
    if (due) insertOccurrence(plant.id, "harvest", due);
  }

  // Winterschutz: einfache Faustregel für nicht winterharte Pflanzen im Freien —
  // Mitte Oktober reinholen, Mitte Mai wieder raus. Grobe Näherung; wo das
  // Pflegeprofil eine genauere winterProtection-Beschreibung hat, ersetzt das
  // künftig eine feinere Regel.
  if (care.placement?.hardy === false && care.placement?.outdoor === true) {
    if (!hasPending(plant.id, "winter_protect_in")) {
      const due = nextDateInMonthList(today, ["Oktober"]) ?? new Date(today.getFullYear() + 1, 9, 15);
      due.setDate(15);
      if (due >= startOfDay(today)) insertOccurrence(plant.id, "winter_protect_in", due);
    }
    if (!hasPending(plant.id, "winter_protect_out")) {
      const due = nextDateInMonthList(today, ["Mai"]) ?? new Date(today.getFullYear() + 1, 4, 15);
      due.setDate(15);
      if (due >= startOfDay(today)) insertOccurrence(plant.id, "winter_protect_out", due);
    }
  }
}

export function generateOccurrencesForAllPlants() {
  const allPlants = db.select().from(plants).all();
  for (const plant of allPlants) {
    generateOccurrencesForPlant(plant);
  }
}

/** Beim Erledigen/Überspringen: Status setzen und die nächste Fälligkeit direkt nachziehen. */
export function completeOccurrence(
  occurrenceId: string,
  status: "done" | "skipped",
  completedDate: Date = new Date(),
) {
  const occurrence = db.select().from(taskOccurrences).where(eq(taskOccurrences.id, occurrenceId)).get();
  if (!occurrence) return null;

  db.update(taskOccurrences)
    .set({ status, completedDate: status === "done" ? completedDate : null })
    .where(eq(taskOccurrences.id, occurrenceId))
    .run();

  const plant = db.select().from(plants).where(eq(plants.id, occurrence.plantId)).get();
  if (plant) generateOccurrencesForPlant(plant);

  return occurrence;
}
