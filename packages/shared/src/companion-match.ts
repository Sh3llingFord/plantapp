import type { CareProfile } from "./care-profile.js";

export type CompanionCheckStatus = "good" | "bad" | "neutral";

/** Namen, unter denen eine Art in companionPlanting-Listen auftauchen kann (klein geschrieben). */
export function speciesMatchNames(care: CareProfile): string[] {
  return [care.identity.botanicalName, ...(care.identity.commonNamesDe ?? [])].map((n) =>
    n.toLowerCase(),
  );
}

/**
 * Vergleicht zwei Pflegeprofile per Namensabgleich (keine Fuzzy-Logik, um keine falschen
 * Warnungen zu erzeugen). "bad" hat Vorrang vor "good", falls beide Listen zufällig einen
 * Treffer liefern. "neutral" heißt: keine Aussage in den Daten, nicht "verträglich".
 */
export function checkCompanionPair(careA: CareProfile, careB: CareProfile): CompanionCheckStatus {
  const namesA = speciesMatchNames(careA);
  const namesB = speciesMatchNames(careB);

  const bad =
    (careA.companionPlanting?.badCompanions?.some((n) => namesB.includes(n.toLowerCase())) ??
      false) ||
    (careB.companionPlanting?.badCompanions?.some((n) => namesA.includes(n.toLowerCase())) ??
      false);
  if (bad) return "bad";

  const good =
    (careA.companionPlanting?.goodCompanions?.some((n) => namesB.includes(n.toLowerCase())) ??
      false) ||
    (careB.companionPlanting?.goodCompanions?.some((n) => namesA.includes(n.toLowerCase())) ??
      false);
  return good ? "good" : "neutral";
}
