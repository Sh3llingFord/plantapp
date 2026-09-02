import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { runMigrations } from "./db/migrate.js";
import { getUserBySessionId, SESSION_COOKIE_NAME } from "./auth/session.js";
import { authRoutes } from "./routes/auth.js";
import { pushRoutes } from "./routes/push.js";
import { locationRoutes } from "./routes/locations.js";
import { speciesRoutes } from "./routes/species.js";
import { plantRoutes } from "./routes/plants.js";
import { enrichmentRoutes } from "./routes/enrichment.js";
import { taskRoutes } from "./routes/tasks.js";
import { calendarRoutes } from "./routes/calendar.js";
import { settingsRoutes } from "./routes/settings.js";
import { startBackupSchedule } from "./backup.js";
import { startTaskSchedule } from "./tasks/schedule.js";
import { startDigestSchedule } from "./push/schedule.js";
import { DATA_DIR } from "./db/paths.js";
import "./vapid.js"; // erzeugt/lädt VAPID-Keys beim Start

runMigrations();
startBackupSchedule();
startTaskSchedule();
startDigestSchedule();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");
const uploadsDir = path.join(DATA_DIR, "uploads");

const app = Fastify({ logger: true });

await app.register(fastifyCookie);
await app.register(fastifyMultipart, {
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB roh, wird danach ohnehin komprimiert
});

// Rohen Body zusätzlich zum geparsten JSON aufbewahren — nötig, um die
// HMAC-Signatur des n8n-Callbacks exakt über die empfangenen Bytes zu prüfen.
app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
  request.rawBody = body as string;
  try {
    done(null, body === "" ? undefined : JSON.parse(body as string));
  } catch (err) {
    done(err as Error, undefined);
  }
});

app.addHook("preHandler", async (request) => {
  const sessionId = request.cookies[SESSION_COOKIE_NAME];
  if (sessionId) {
    request.user = getUserBySessionId(sessionId) ?? undefined;
  }
});

app.get("/api/health", async () => {
  return { status: "ok" };
});

await app.register(authRoutes);
await app.register(pushRoutes);
await app.register(locationRoutes);
await app.register(speciesRoutes);
await app.register(plantRoutes);
await app.register(enrichmentRoutes);
await app.register(taskRoutes);
await app.register(calendarRoutes);
await app.register(settingsRoutes);

await app.register(fastifyStatic, {
  root: uploadsDir,
  prefix: "/uploads/",
  decorateReply: false,
});

app.register(fastifyStatic, {
  root: webDist,
  wildcard: false,
});

app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) {
    reply.code(404).send({ error: "not found" });
    return;
  }
  reply.sendFile("index.html");
});

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
