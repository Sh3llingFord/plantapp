import { Cron } from "croner";
import { refreshWeatherAndWarn } from "./refresh.js";
import type { FastifyBaseLogger } from "fastify";

export function startWeatherSchedule(log?: FastifyBaseLogger) {
  // Einmal beim Start, danach täglich um 18:00 — rechtzeitig vor Frostnächten,
  // um Pflanzen noch am selben Abend reinholen zu können.
  refreshWeatherAndWarn(log);
  new Cron("0 18 * * *", () => refreshWeatherAndWarn(log));
}
