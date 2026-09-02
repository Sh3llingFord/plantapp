import { z } from "zod";

/**
 * Pflegeprofil-Schema — die zentrale Vertragsdefinition (siehe docs/ROADMAP.md, M1).
 * Jedes Datenfeld ist nullable: "unbekannt" ist ein zulässiger Wert und besser als
 * eine erfundene Angabe. Nur strukturelle Pflichtfelder (botanischer Name,
 * Schema-Version) sind required.
 */

export const LightLevel = z.enum(["full_sun", "partial_sun", "bright_indirect", "shade"]);
export type LightLevel = z.infer<typeof LightLevel>;

export const CompassDirection = z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
export type CompassDirection = z.infer<typeof CompassDirection>;

export const GrowthRate = z.enum(["slow", "medium", "fast"]);
export type GrowthRate = z.infer<typeof GrowthRate>;

export const PruningType = z.enum(["shape", "thinning", "rejuvenation", "deadheading"]);
export type PruningType = z.infer<typeof PruningType>;

const identitySchema = z.object({
  botanicalName: z.string(),
  commonNamesDe: z.array(z.string()).nullable(),
  commonNamesEn: z.array(z.string()).nullable(),
  family: z.string().nullable(),
  cultivar: z.string().nullable(),
});
export type Identity = z.infer<typeof identitySchema>;

const placementSchema = z.object({
  light: LightLevel.nullable(),
  indoor: z.boolean().nullable(),
  outdoor: z.boolean().nullable(),
  recommendedDirection: z.array(CompassDirection).nullable(),
  humidityMinPct: z.number().nullable(),
  humidityMaxPct: z.number().nullable(),
  temperatureMinC: z.number().nullable(),
  temperatureOptimalC: z.number().nullable(),
  temperatureMaxC: z.number().nullable(),
  hardy: z.boolean().nullable(),
  hardyToC: z.number().nullable(),
  winterProtection: z.string().nullable(),
});
export type Placement = z.infer<typeof placementSchema>;

const waterIntervalDaysBySeasonSchema = z.object({
  spring: z.number().nullable(),
  summer: z.number().nullable(),
  autumn: z.number().nullable(),
  winter: z.number().nullable(),
});

const waterSchema = z.object({
  intervalDaysBySeason: waterIntervalDaysBySeasonSchema.nullable(),
  amount: z.string().nullable(),
  method: z.string().nullable(),
  letTopLayerDryOut: z.boolean().nullable(),
});
export type Water = z.infer<typeof waterSchema>;

const soilSchema = z.object({
  substrate: z.string().nullable(),
  phMin: z.number().nullable(),
  phMax: z.number().nullable(),
  drainage: z.string().nullable(),
});
export type Soil = z.infer<typeof soilSchema>;

const fertilizerSchema = z.object({
  npk: z.string().nullable(),
  rhythm: z.string().nullable(),
  seasonWindow: z.array(z.string()).nullable(),
});
export type Fertilizer = z.infer<typeof fertilizerSchema>;

const pruningWindowSchema = z.object({
  type: PruningType,
  months: z.array(z.string()),
});

const pruningSchema = z.object({
  windows: z.array(pruningWindowSchema).nullable(),
});
export type Pruning = z.infer<typeof pruningSchema>;

const repottingSchema = z.object({
  everyYears: z.number().nullable(),
  bestMonths: z.array(z.string()).nullable(),
});
export type Repotting = z.infer<typeof repottingSchema>;

const bloomSchema = z.object({
  months: z.array(z.string()).nullable(),
  color: z.string().nullable(),
  fragrant: z.boolean().nullable(),
  deadheadSpentBlooms: z.boolean().nullable(),
});
export type Bloom = z.infer<typeof bloomSchema>;

const harvestSchema = z.object({
  months: z.array(z.string()).nullable(),
});
export type Harvest = z.infer<typeof harvestSchema>;

const sowingSchema = z.object({
  indoorMonths: z.array(z.string()).nullable(), // Voranzucht am Fensterbrett
  outdoorMonths: z.array(z.string()).nullable(), // Direktsaat ins Freiland
  plantOutMonths: z.array(z.string()).nullable(), // vorgezogene Jungpflanzen auspflanzen
  daysToGermination: z.number().nullable(),
});
export type Sowing = z.infer<typeof sowingSchema>;

const companionPlantingSchema = z.object({
  goodCompanions: z.array(z.string()).nullable(), // gängige (deutsche) Pflanzennamen
  badCompanions: z.array(z.string()).nullable(),
  notes: z.string().nullable(),
});
export type CompanionPlanting = z.infer<typeof companionPlantingSchema>;

const propagationSchema = z.object({
  methods: z.array(z.string()).nullable(),
  bestMonths: z.array(z.string()).nullable(),
});
export type Propagation = z.infer<typeof propagationSchema>;

const toxicitySchema = z.object({
  petsToxic: z.boolean().nullable(),
  petNotes: z.string().nullable(),
  childrenToxic: z.boolean().nullable(),
  childrenNotes: z.string().nullable(),
});
export type Toxicity = z.infer<typeof toxicitySchema>;

const sizeSchema = z.object({
  heightMinCm: z.number().nullable(),
  heightMaxCm: z.number().nullable(),
  widthMinCm: z.number().nullable(),
  widthMaxCm: z.number().nullable(),
  growthRate: GrowthRate.nullable(),
});
export type Size = z.infer<typeof sizeSchema>;

const problemSchema = z.object({
  name: z.string(),
  symptoms: z.string().nullable(),
  remedy: z.string().nullable(),
});
export type Problem = z.infer<typeof problemSchema>;

const metaSchema = z.object({
  confidence: z.record(z.string(), z.number()).nullable(),
  sources: z.array(z.string()).nullable(),
  model: z.string().nullable(),
  schemaVersion: z.number(),
  promptVersion: z.string().nullable(),
});
export type Meta = z.infer<typeof metaSchema>;

export const CareProfileSchema = z.object({
  identity: identitySchema,
  placement: placementSchema.nullable(),
  water: waterSchema.nullable(),
  soil: soilSchema.nullable(),
  fertilizer: fertilizerSchema.nullable(),
  pruning: pruningSchema.nullable(),
  repotting: repottingSchema.nullable(),
  bloom: bloomSchema.nullable(),
  harvest: harvestSchema.nullable(),
  sowing: sowingSchema.nullable(),
  companionPlanting: companionPlantingSchema.nullable(),
  propagation: propagationSchema.nullable(),
  toxicity: toxicitySchema.nullable(),
  size: sizeSchema.nullable(),
  problems: z.array(problemSchema).nullable(),
  meta: metaSchema,
});
export type CareProfile = z.infer<typeof CareProfileSchema>;

// v2 (M7): neue Abschnitte `sowing` und `companionPlanting`. Additiv (beide nullable), alte
// gespeicherte Profile werden weiterhin gelesen — der Versionssprung sorgt nur dafür, dass
// species_cache-Einträge aus v1 nicht wiederverwendet werden, sondern neu recherchiert werden.
export const CARE_PROFILE_SCHEMA_VERSION = 2;
