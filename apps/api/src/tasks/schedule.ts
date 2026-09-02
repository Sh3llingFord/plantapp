import { Cron } from "croner";
import { generateOccurrencesForAllPlants } from "./generate.js";

export function startTaskSchedule() {
  // Einmal beim Start (z.B. nach Wochen Downtime/Neuaufsetzen fehlende
  // Fälligkeiten sofort nachziehen), danach nächtlich.
  generateOccurrencesForAllPlants();
  new Cron("0 4 * * *", generateOccurrencesForAllPlants);
}
