import type { FastifyInstance } from "fastify";
import { eq, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import { appSettings, weatherCache } from "../db/schema.js";
import { geocodeLocation } from "../weather/openmeteo.js";
import { refreshWeatherAndWarn } from "../weather/refresh.js";

interface LocationBody {
  query: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function weatherRoutes(app: FastifyInstance) {
  app.get("/api/weather/location", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const settings = db.select().from(appSettings).where(eq(appSettings.id, "default")).get();
    return {
      locationName: settings?.locationName ?? null,
      latitude: settings?.latitude ?? null,
      longitude: settings?.longitude ?? null,
    };
  });

  app.post<{ Body: LocationBody }>("/api/weather/location", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const query = request.body?.query?.trim();
    if (!query) return reply.code(400).send({ error: "Ortsname fehlt" });

    let result;
    try {
      result = await geocodeLocation(query);
    } catch (err) {
      request.log.warn({ err }, "Geocoding fehlgeschlagen");
      return reply.code(502).send({ error: "Geocoding fehlgeschlagen — später erneut versuchen" });
    }
    if (!result) return reply.code(404).send({ error: `Kein Ort gefunden für "${query}"` });

    db.insert(appSettings)
      .values({
        id: "default",
        locationName: result.label,
        latitude: result.latitude,
        longitude: result.longitude,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { locationName: result.label, latitude: result.latitude, longitude: result.longitude, updatedAt: new Date() },
      })
      .run();

    refreshWeatherAndWarn(request.log).catch((err) => request.log.warn({ err }, "Wetter-Refresh nach Standortänderung fehlgeschlagen"));

    return { locationName: result.label, latitude: result.latitude, longitude: result.longitude };
  });

  app.get("/api/weather/forecast", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "nicht eingeloggt" });
    const rows = db
      .select()
      .from(weatherCache)
      .where(gte(weatherCache.date, todayStr()))
      .orderBy(weatherCache.date)
      .all();
    return rows;
  });
}
