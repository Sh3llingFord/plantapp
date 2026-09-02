import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { CareProfileSchema, type CareProfile } from "@plantapp/shared";
import { db } from "../db/client.js";
import { species } from "../db/schema.js";
import { runMigrations } from "../db/migrate.js";
import { deriveFilterColumns, slugify } from "../species/helpers.js";
import { indexSpecies } from "../search/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, "../../../../data/seeds/plants.seed.json");

runMigrations();

const raw = JSON.parse(readFileSync(seedPath, "utf-8"));
if (!Array.isArray(raw)) {
  throw new Error(`Erwartet ein JSON-Array in ${seedPath}`);
}

let inserted = 0;
let updated = 0;

for (const entry of raw) {
  const parsed: CareProfile = CareProfileSchema.parse(entry);
  const id = slugify(parsed.identity.botanicalName);
  const filterColumns = deriveFilterColumns(parsed);

  const existing = db.select().from(species).where(eq(species.id, id)).get();

  if (existing) {
    db.update(species)
      .set({ careProfile: parsed, ...filterColumns })
      .where(eq(species.id, id))
      .run();
    updated++;
  } else {
    db.insert(species)
      .values({
        id,
        botanicalName: parsed.identity.botanicalName,
        careProfile: parsed,
        ...filterColumns,
        isSeed: true,
        createdAt: new Date(),
      })
      .run();
    inserted++;
  }

  indexSpecies(id, parsed.identity.botanicalName, parsed);
}

console.log(`Seeds verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${raw.length} gesamt.`);
