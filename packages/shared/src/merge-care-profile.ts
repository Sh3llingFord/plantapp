import type { CareProfile } from "./care-profile.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-merged Overrides über ein Basis-CareProfile (z.B. Katalog-Standard <- Pflanzen-Override). */
export function mergeCareProfile(
  base: CareProfile,
  overrides: Partial<CareProfile> | null | undefined,
): CareProfile {
  if (!overrides) return base;
  return deepMerge(base, overrides) as CareProfile;
}

function deepMerge(base: unknown, overrides: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(overrides)) {
    const result: Record<string, unknown> = { ...base };
    for (const key of Object.keys(overrides)) {
      result[key] = deepMerge(base[key], overrides[key]);
    }
    return result;
  }
  return overrides === undefined ? base : overrides;
}
