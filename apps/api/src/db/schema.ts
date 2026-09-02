import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  direction: text("direction"), // N/NE/E/SE/S/SW/W/NW, nullable
  indoor: integer("indoor", { mode: "boolean" }).notNull(),
  lightEstimate: text("light_estimate"), // full_sun/partial_sun/bright_indirect/shade
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const species = sqliteTable("species", {
  id: text("id").primaryKey(),
  botanicalName: text("botanical_name").notNull().unique(),
  careProfile: text("care_profile", { mode: "json" }).notNull(), // vollständiges CareProfile-JSON
  // denormalisierte Filter-/Suchspalten, aus careProfile extrahiert:
  light: text("light"),
  hardy: integer("hardy", { mode: "boolean" }),
  petsToxic: integer("pets_toxic", { mode: "boolean" }),
  indoor: integer("indoor", { mode: "boolean" }),
  outdoor: integer("outdoor", { mode: "boolean" }),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(true),
  photoPath: text("photo_path"), // von Nutzern selbst hochgeladenes Referenzfoto
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const plants = sqliteTable("plants", {
  id: text("id").primaryKey(),
  nickname: text("nickname").notNull(),
  speciesId: text("species_id").references(() => species.id, { onDelete: "set null" }),
  freeTextSpecies: text("free_text_species"), // falls nicht aus dem Katalog gewählt
  locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  notes: text("notes"),
  photoPath: text("photo_path"),
  // Partielles CareProfile-JSON: überschreibt einzelne Felder des Katalog-Pflegeprofils
  // für genau diese eine Pflanze (z.B. abweichender Standort/Gießrhythmus).
  careProfileOverrides: text("care_profile_overrides", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// M2 — KI-Anreicherung ausschließlich über n8n (siehe docs/ROADMAP.md).
// cacheKey = normalisierter Artname + ":" + schemaVersion + ":" + (promptVersion ?? "-")
export const speciesCache = sqliteTable("species_cache", {
  cacheKey: text("cache_key").primaryKey(),
  query: text("query").notNull(),
  careProfile: text("care_profile", { mode: "json" }).notNull(),
  schemaVersion: integer("schema_version").notNull(),
  promptVersion: text("prompt_version"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const enrichmentJobs = sqliteTable("enrichment_jobs", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  plantId: text("plant_id").references(() => plants.id, { onDelete: "set null" }),
  status: text("status").notNull(), // queued | done | failed
  resultSpeciesId: text("result_species_id").references(() => species.id, {
    onDelete: "set null",
  }),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
