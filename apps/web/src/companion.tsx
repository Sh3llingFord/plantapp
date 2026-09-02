import type { CareProfile } from "@plantapp/shared";
import type { Plant } from "./api";

type CompanionPlanting = CareProfile["companionPlanting"];

interface Neighbor {
  nickname: string;
  names: string[]; // botanischer Name, deutsche Trivialnamen, Freitext — alles klein geschrieben
}

function neighborNames(plant: Plant): string[] {
  const names = [
    plant.speciesBotanicalName,
    ...(plant.speciesCareProfile?.identity.commonNamesDe ?? []),
    plant.freeTextSpecies,
  ];
  return names.filter((n): n is string => !!n).map((n) => n.toLowerCase());
}

function findMatches(list: string[] | null, neighbors: Neighbor[]): { nickname: string; matchedName: string }[] {
  if (!list) return [];
  const wanted = list.map((n) => n.toLowerCase());
  const matches: { nickname: string; matchedName: string }[] = [];
  for (const neighbor of neighbors) {
    const hit = neighbor.names.find((n) => wanted.includes(n));
    if (hit) matches.push({ nickname: neighbor.nickname, matchedName: hit });
  }
  return matches;
}

/** Zeigt recherchierte Nachbarschaftsempfehlungen und gleicht sie mit tatsächlich am selben
 * Standort stehenden eigenen Pflanzen ab. Nur exakte Namenstreffer (botanisch, deutscher
 * Trivialname oder Freitext) — keine Fuzzy-Logik, um keine falschen Warnungen zu erzeugen. */
export function CompanionCard({
  companionPlanting,
  neighborPlants,
  ownPlantId,
}: {
  companionPlanting: CompanionPlanting | null | undefined;
  neighborPlants: Plant[];
  ownPlantId: string;
}) {
  if (!companionPlanting) return null;
  const { goodCompanions, badCompanions, notes } = companionPlanting;
  if (!goodCompanions && !badCompanions && !notes) return null;

  const neighbors: Neighbor[] = neighborPlants
    .filter((p) => p.id !== ownPlantId)
    .map((p) => ({ nickname: p.nickname, names: neighborNames(p) }));

  const goodMatches = findMatches(goodCompanions, neighbors);
  const badMatches = findMatches(badCompanions, neighbors);

  return (
    <div className="detail-card">
      <p className="section__title">
        <span aria-hidden="true">🌼</span> Nachbarschaft
      </p>

      {badMatches.length > 0 && (
        <p className="alert alert--error" style={{ marginBottom: 8 }}>
          ⚠️ Am selben Standort: {badMatches.map((m) => m.nickname).join(", ")} — laut Recherche
          keine gute Nachbarschaft.
        </p>
      )}
      {goodMatches.length > 0 && (
        <p style={{ marginBottom: 8, color: "var(--color-success-text)" }}>
          ✓ {goodMatches.map((m) => m.nickname).join(", ")} passt hier laut Recherche gut dazu.
        </p>
      )}

      {goodCompanions && goodCompanions.length > 0 && (
        <p style={{ fontSize: 13, marginBottom: 4 }}>
          <strong>Gute Nachbarn:</strong> {goodCompanions.join(", ")}
        </p>
      )}
      {badCompanions && badCompanions.length > 0 && (
        <p style={{ fontSize: 13, marginBottom: 4 }}>
          <strong>Schlechte Nachbarn:</strong> {badCompanions.join(", ")}
        </p>
      )}
      {notes && (
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{notes}</p>
      )}
    </div>
  );
}
