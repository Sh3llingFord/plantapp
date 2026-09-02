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
import { startBackupSchedule } from "./backup.js";
import { DATA_DIR } from "./db/paths.js";
import "./vapid.js"; // erzeugt/lädt VAPID-Keys beim Start

runMigrations();
startBackupSchedule();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");
const uploadsDir = path.join(DATA_DIR, "uploads");

const app = Fastify({ logger: true });

await app.register(fastifyCookie);
await app.register(fastifyMultipart);

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
