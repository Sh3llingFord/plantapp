import type { CareProfile } from "@plantapp/shared";

type Toxicity = CareProfile["toxicity"];

export function ToxicityBadges({ toxicity }: { toxicity: Toxicity | null | undefined }) {
  if (!toxicity) return null;
  const badges: string[] = [];
  if (toxicity.petsToxic) badges.push("🐾");
  if (toxicity.childrenToxic) badges.push("🚸");
  if (badges.length === 0) return null;

  return (
    <span className="list-item__badges" title="Giftig — Details in der Pflanze ansehen">
      {badges.map((b) => (
        <span key={b} className="tag tag--danger" aria-hidden="true">
          {b}
        </span>
      ))}
    </span>
  );
}

export function ToxicityBanner({ toxicity }: { toxicity: Toxicity | null | undefined }) {
  if (!toxicity) return null;

  const isToxic = toxicity.petsToxic || toxicity.childrenToxic;
  const bothKnown = toxicity.petsToxic !== null && toxicity.childrenToxic !== null;
  const knownSafe = bothKnown && !toxicity.petsToxic && !toxicity.childrenToxic;

  if (!isToxic && !knownSafe) return null; // unbekannt -> nichts behaupten

  return (
    <div className={`toxicity-banner ${isToxic ? "" : "toxicity-banner--safe"}`}>
      <p className="toxicity-banner__title">
        <span aria-hidden="true">{isToxic ? "⚠️" : "✅"}</span>
        {isToxic ? "Giftig" : "Unbedenklich"} für Menschen & Haustiere
      </p>
      {toxicity.petsToxic !== null && (
        <p>
          <strong>Haustiere (Hund/Katze):</strong> {toxicity.petsToxic ? "giftig" : "unbedenklich"}
          {toxicity.petNotes ? ` — ${toxicity.petNotes}` : ""}
        </p>
      )}
      {toxicity.childrenToxic !== null && (
        <p>
          <strong>Kinder & Babys:</strong> {toxicity.childrenToxic ? "giftig" : "unbedenklich"}
          {toxicity.childrenNotes ? ` — ${toxicity.childrenNotes}` : ""}
        </p>
      )}
    </div>
  );
}
