import type { CareProfile } from "./care-profile.js";

/** Prüft, ob ein Aussaat-, Direktsaat- oder Auspflanzfenster den angegebenen Monat trifft. */
export function isSowableInMonth(sowing: CareProfile["sowing"], monthName: string): boolean {
  if (!sowing) return false;
  const lists = [sowing.indoorMonths, sowing.outdoorMonths, sowing.plantOutMonths];
  return lists.some((list) => list?.some((m) => m.toLowerCase() === monthName.toLowerCase()) ?? false);
}
