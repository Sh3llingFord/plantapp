import { Cron } from "croner";
import { runDigestCheck } from "./digest.js";

export function startDigestSchedule() {
  // Alle 15 Minuten prüfen statt fix um 8:00 zu feuern — respektiert damit
  // individuell eingestellte Ruhezeiten (quietHoursStart) je Nutzer, ohne
  // pro Nutzer einen eigenen Cron-Zeitpunkt verwalten zu müssen.
  new Cron("*/15 * * * *", runDigestCheck);
}
