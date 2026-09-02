import { and, eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { mergeCareProfile, type CareProfile } from "@plantapp/shared";
import { db } from "../db/client.js";
import { appSettings, plants, species, taskOccurrences, users, weatherCache } from "../db/schema.js";
import { sendPushToUser } from "../push/send.js";
import { fetchForecast, type DailyForecastDay } from "./openmeteo.js";

const FROST_THRESHOLD_C = 3;
const HEAT_THRESHOLD_C = 30;
const RAIN_THRESHOLD_MM = 5;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface OutdoorPlant {
  id: string;
  nickname: string;
  care: CareProfile;
}

function getOutdoorPlants(): OutdoorPlant[] {
  const rows = db
    .select({
      id: plants.id,
      nickname: plants.nickname,
      speciesId: plants.speciesId,
      careProfileOverrides: plants.careProfileOverrides,
      speciesCareProfile: species.careProfile,
    })
    .from(plants)
    .leftJoin(species, eq(plants.speciesId, species.id))
    .all();

  const result: OutdoorPlant[] = [];
  for (const row of rows) {
    if (!row.speciesCareProfile) continue;
    const care = mergeCareProfile(
      row.speciesCareProfile as CareProfile,
      row.careProfileOverrides as Partial<CareProfile> | null,
    );
    if (care.placement?.outdoor === true) {
      result.push({ id: row.id, nickname: row.nickname, care });
    }
  }
  return result;
}

async function notifyAllUsers(payload: { title: string; body: string }) {
  const allUsers = db.select({ id: users.id }).from(users).all();
  for (const u of allUsers) {
    await sendPushToUser(u.id, payload);
  }
}

async function checkFrostWarning(days: DailyForecastDay[]) {
  const settings = db.select().from(appSettings).where(eq(appSettings.id, "default")).get();
  if (settings?.lastFrostWarningDate === todayStr()) return;

  // "in den nächsten 48h" = heute + morgen.
  const next48h = days.slice(0, 2);
  if (next48h.length === 0) return;
  const minForecast = Math.min(...next48h.map((d) => d.tempMinC));
  if (minForecast >= FROST_THRESHOLD_C) return;

  const atRisk = getOutdoorPlants().filter(
    (p) => p.care.placement?.hardyToC !== null && p.care.placement?.hardyToC !== undefined && minForecast < p.care.placement.hardyToC,
  );
  if (atRisk.length === 0) return;

  const names = atRisk.map((p) => p.nickname);
  const body =
    names.length <= 3
      ? `${names.join(", ")} vor Frost schützen oder reinholen (Tiefstwert ${minForecast.toFixed(0)}°C in 48h).`
      : `${names.slice(0, 3).join(", ")} und ${names.length - 3} weitere vor Frost schützen (Tiefstwert ${minForecast.toFixed(0)}°C in 48h).`;

  await notifyAllUsers({ title: "🥶 Frostwarnung", body });

  db.insert(appSettings)
    .values({ id: "default", lastFrostWarningDate: todayStr() })
    .onConflictDoUpdate({ target: appSettings.id, set: { lastFrostWarningDate: todayStr() } })
    .run();
}

async function checkHeatWarning(days: DailyForecastDay[]) {
  const settings = db.select().from(appSettings).where(eq(appSettings.id, "default")).get();
  if (settings?.lastHeatWarningDate === todayStr()) return;

  const today = days[0];
  if (!today || today.tempMaxC <= HEAT_THRESHOLD_C) return;

  const outdoorCount = getOutdoorPlants().length;
  if (outdoorCount === 0) return;

  await notifyAllUsers({
    title: "☀️ Hitzewarnung",
    body: `Heute bis zu ${today.tempMaxC.toFixed(0)}°C — Kübelpflanzen im Freien ggf. zusätzlich gießen und beschatten.`,
  });

  db.insert(appSettings)
    .values({ id: "default", lastHeatWarningDate: todayStr() })
    .onConflictDoUpdate({ target: appSettings.id, set: { lastHeatWarningDate: todayStr() } })
    .run();
}

/**
 * Verschiebt fällige Gieß-Aufgaben von Außenpflanzen um einen Tag, wenn heute
 * genug Regen fällt (Regenwasser übernimmt das Gießen). Mit sichtbarer
 * Begründung im "note"-Feld statt stillschweigend.
 */
function applyRainPostponement(days: DailyForecastDay[], log?: FastifyBaseLogger) {
  const today = days[0];
  if (!today || today.precipitationSumMm < RAIN_THRESHOLD_MM) return;

  const outdoorPlantIds = new Set(getOutdoorPlants().map((p) => p.id));
  if (outdoorPlantIds.size === 0) return;

  const pendingWaterTasks = db
    .select()
    .from(taskOccurrences)
    .where(and(eq(taskOccurrences.type, "water"), eq(taskOccurrences.status, "pending")))
    .all();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = addDays(startOfToday, 1);

  let postponed = 0;
  for (const task of pendingWaterTasks) {
    if (!outdoorPlantIds.has(task.plantId)) continue;
    if (task.dueDate < startOfToday || task.dueDate >= endOfToday) continue; // nur heute fällige

    db.update(taskOccurrences)
      .set({
        dueDate: addDays(task.dueDate, 1),
        note: `Wegen Regen (${today.precipitationSumMm.toFixed(0)} mm) automatisch verschoben.`,
      })
      .where(eq(taskOccurrences.id, task.id))
      .run();
    postponed++;
  }
  if (postponed > 0) log?.info(`Regenregel: ${postponed} Gieß-Aufgabe(n) verschoben`);
}

export async function refreshWeatherAndWarn(log?: FastifyBaseLogger) {
  const settings = db.select().from(appSettings).where(eq(appSettings.id, "default")).get();
  if (!settings?.latitude || !settings?.longitude) return;

  let days: DailyForecastDay[];
  try {
    days = await fetchForecast(settings.latitude, settings.longitude);
  } catch (err) {
    log?.warn({ err }, "Wettervorhersage konnte nicht abgerufen werden");
    return;
  }

  const now = new Date();
  for (const day of days) {
    db.insert(weatherCache)
      .values({ date: day.date, tempMinC: day.tempMinC, tempMaxC: day.tempMaxC, precipitationSumMm: day.precipitationSumMm, fetchedAt: now })
      .onConflictDoUpdate({
        target: weatherCache.date,
        set: { tempMinC: day.tempMinC, tempMaxC: day.tempMaxC, precipitationSumMm: day.precipitationSumMm, fetchedAt: now },
      })
      .run();
  }

  await checkFrostWarning(days);
  applyRainPostponement(days, log);
  await checkHeatWarning(days);
}
