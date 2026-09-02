import { matchLocation, type CareProfile, type LocationMatchTier } from "@plantapp/shared";
import type { Location } from "./api";

const TIER_ICON: Record<LocationMatchTier, string> = {
  good: "🟢",
  partial: "🟡",
  bad: "🔴",
  unknown: "",
};

const TIER_LABEL: Record<LocationMatchTier, string> = {
  good: "passt gut",
  partial: "passt bedingt",
  bad: "passt nicht",
  unknown: "nicht bewertbar",
};

export { matchLocation };
export type { LocationMatchTier };

/** Kleines Badge für Listen — nur sichtbar, wenn der Standort wirklich nicht passt. */
export function LocationMatchBadge({
  care,
  location,
}: {
  care: CareProfile | null | undefined;
  location: Location | null | undefined;
}) {
  if (!care || !location) return null;
  const { tier, reasons } = matchLocation(care, location);
  if (tier !== "bad") return null;

  return (
    <span className="tag tag--danger" title={reasons.join("; ")}>
      ⚠️ Standort passt nicht
    </span>
  );
}

/** Ausführliche Anzeige für die Detailseite. */
export function LocationMatchCard({
  care,
  location,
}: {
  care: CareProfile | null | undefined;
  location: Location | null | undefined;
}) {
  if (!care || !location) return null;
  const { tier, reasons } = matchLocation(care, location);

  return (
    <div className="detail-card">
      <p className="section__title">
        <span aria-hidden="true">📍</span> Standort-Check
      </p>
      <span className={`tag ${tier === "good" ? "tag--ok" : tier === "partial" ? "tag--warn" : tier === "bad" ? "tag--danger" : "tag--muted"}`}>
        {TIER_ICON[tier]} {TIER_LABEL[tier]}
      </span>
      {reasons.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--color-text-muted)" }}>
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Präfix für <option>-Labels bei der Standortauswahl im Formular (Live-Vorschau). */
export function locationOptionPrefix(care: CareProfile | null, location: Location): string {
  if (!care) return "";
  const { tier } = matchLocation(care, location);
  const icon = TIER_ICON[tier];
  return icon ? `${icon} ` : "";
}
