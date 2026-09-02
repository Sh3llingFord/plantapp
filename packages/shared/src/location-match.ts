import type { CareProfile, CompassDirection, LightLevel } from "./care-profile.js";

/**
 * M6 — Standort-Match-Score. Bewertet ausschließlich mit bereits vorhandenen
 * Feldern (kein neuer Recherchebedarf). Absichtlich nur 3 grobe Stufen statt
 * eines Prozentwerts — die Datenlage (grobe Lichtkategorien, eine Himmelsrichtung
 * pro Standort) trägt keine höhere Präzision. Fehlen die nötigen Angaben auf
 * einer Seite, ist das Ergebnis "unknown" statt eines geratenen Werts.
 */

export type LocationMatchTier = "good" | "partial" | "bad" | "unknown";

export interface LocationForMatch {
  indoor: boolean;
  direction: CompassDirection | null;
  lightEstimate: LightLevel | null;
}

export interface LocationMatchResult {
  tier: LocationMatchTier;
  reasons: string[];
}

// Grobe Ordnung nach Lichtintensität/Dauer direkter Sonne, für Distanzvergleich.
const LIGHT_ORDER: Record<LightLevel, number> = {
  shade: 0,
  bright_indirect: 1,
  partial_sun: 2,
  full_sun: 3,
};

const LIGHT_LABELS_DE: Record<LightLevel, string> = {
  shade: "Schatten",
  bright_indirect: "hell, indirekt",
  partial_sun: "Halbschatten",
  full_sun: "volle Sonne",
};

// Benachbarte Himmelsrichtungen — für "bedingt passt" statt "passt nicht".
const DIRECTION_NEIGHBORS: Record<CompassDirection, CompassDirection[]> = {
  N: ["NW", "NE"],
  NE: ["N", "E"],
  E: ["NE", "SE"],
  SE: ["E", "S"],
  S: ["SE", "SW"],
  SW: ["S", "W"],
  W: ["SW", "NW"],
  NW: ["W", "N"],
};

type CriterionResult = "match" | "partial" | "mismatch";

/** Bewertet Pflegeprofil einer Pflanze gegen einen Standort. */
export function matchLocation(care: CareProfile, location: LocationForMatch): LocationMatchResult {
  const results: { result: CriterionResult; reason: string }[] = [];
  const placement = care.placement;

  // Indoor/Outdoor.
  if (placement) {
    const needsIndoor = placement.indoor;
    const needsOutdoor = placement.outdoor;
    if (needsIndoor !== null || needsOutdoor !== null) {
      const suited = location.indoor ? needsIndoor : needsOutdoor;
      if (suited === true) {
        results.push({ result: "match", reason: "" });
      } else if (suited === false) {
        results.push({
          result: "mismatch",
          reason: location.indoor
            ? "Pflanze ist als reine Außenpflanze eingestuft, Standort ist innen"
            : "Pflanze ist als reine Innenraumpflanze eingestuft, Standort ist außen",
        });
      }
      // suited === null (die jeweils andere Angabe fehlt) -> nicht bewertbar, kein Eintrag.
    }
  }

  // Licht.
  if (placement?.light && location.lightEstimate) {
    const diff = Math.abs(LIGHT_ORDER[placement.light] - LIGHT_ORDER[location.lightEstimate]);
    if (diff === 0) {
      results.push({ result: "match", reason: "" });
    } else if (diff === 1) {
      results.push({
        result: "partial",
        reason: `Standort bietet ${LIGHT_LABELS_DE[location.lightEstimate]}, Pflanze bevorzugt ${LIGHT_LABELS_DE[placement.light]}`,
      });
    } else {
      results.push({
        result: "mismatch",
        reason: `Standort bietet ${LIGHT_LABELS_DE[location.lightEstimate]}, Pflanze braucht ${LIGHT_LABELS_DE[placement.light]}`,
      });
    }
  }

  // Himmelsrichtung.
  if (placement?.recommendedDirection && placement.recommendedDirection.length > 0 && location.direction) {
    const wanted = placement.recommendedDirection;
    if (wanted.includes(location.direction)) {
      results.push({ result: "match", reason: "" });
    } else {
      const isNeighbor = wanted.some((w) => DIRECTION_NEIGHBORS[w]?.includes(location.direction!));
      if (isNeighbor) {
        results.push({
          result: "partial",
          reason: `${location.direction}-Standort liegt nahe an der empfohlenen Richtung (${wanted.join("/")})`,
        });
      } else {
        results.push({
          result: "mismatch",
          reason: `${location.direction}-Standort, empfohlen wäre ${wanted.join("/")}`,
        });
      }
    }
  }

  if (results.length === 0) {
    return { tier: "unknown", reasons: [] };
  }

  const reasons = results.filter((r) => r.reason).map((r) => r.reason);
  if (results.some((r) => r.result === "mismatch")) {
    return { tier: "bad", reasons };
  }
  if (results.some((r) => r.result === "partial")) {
    return { tier: "partial", reasons };
  }
  return { tier: "good", reasons: [] };
}
