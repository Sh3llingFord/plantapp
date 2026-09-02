import { eq } from "drizzle-orm";
import { CARE_PROFILE_SCHEMA_VERSION, type CareProfile } from "@plantapp/shared";
import { db } from "../db/client.js";
import { species, speciesCache } from "../db/schema.js";
import { deriveFilterColumns, slugify } from "../species/helpers.js";
import { indexSpecies } from "../search/index.js";

export const PROMPT_VERSION = "v1";

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cacheKeyFor(query: string): string {
  return `${normalizeQuery(query)}:${CARE_PROFILE_SCHEMA_VERSION}:${PROMPT_VERSION}`;
}

export function getCachedCareProfile(query: string): CareProfile | null {
  const row = db
    .select()
    .from(speciesCache)
    .where(eq(speciesCache.cacheKey, cacheKeyFor(query)))
    .get();
  return row ? (row.careProfile as CareProfile) : null;
}

/** Legt (oder aktualisiert) den Cache-Eintrag UND den zugehörigen Katalog-Eintrag an. */
export function storeEnrichmentResult(query: string, careProfile: CareProfile): string {
  const cacheKey = cacheKeyFor(query);
  const now = new Date();

  db.insert(speciesCache)
    .values({
      cacheKey,
      query: normalizeQuery(query),
      careProfile,
      schemaVersion: CARE_PROFILE_SCHEMA_VERSION,
      promptVersion: PROMPT_VERSION,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: speciesCache.cacheKey,
      set: { careProfile, createdAt: now },
    })
    .run();

  const speciesId = slugify(careProfile.identity.botanicalName);
  const filterColumns = deriveFilterColumns(careProfile);
  const existing = db.select().from(species).where(eq(species.id, speciesId)).get();

  if (existing) {
    db.update(species)
      .set({ careProfile, ...filterColumns })
      .where(eq(species.id, speciesId))
      .run();
  } else {
    db.insert(species)
      .values({
        id: speciesId,
        botanicalName: careProfile.identity.botanicalName,
        careProfile,
        ...filterColumns,
        isSeed: false,
        createdAt: now,
      })
      .run();
  }

  indexSpecies(speciesId, careProfile.identity.botanicalName, careProfile);
  return speciesId;
}
