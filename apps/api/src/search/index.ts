import { sqlite } from "../db/client.js";
import type { CareProfile } from "@plantapp/shared";

export type SearchKind = "species" | "plant";

function textForSpecies(botanicalName: string, careProfile: CareProfile): string {
  const names = [
    botanicalName,
    ...(careProfile.identity.commonNamesDe ?? []),
    ...(careProfile.identity.commonNamesEn ?? []),
  ];
  return names.join(" ");
}

export function indexSpecies(id: string, botanicalName: string, careProfile: CareProfile) {
  removeFromIndex("species", id);
  sqlite
    .prepare("INSERT INTO search_fts (text, kind, ref_id) VALUES (?, 'species', ?)")
    .run(textForSpecies(botanicalName, careProfile), id);
}

export function indexPlant(
  id: string,
  nickname: string,
  freeTextSpecies: string | null,
  notes: string | null,
) {
  removeFromIndex("plant", id);
  const text = [nickname, freeTextSpecies, notes].filter(Boolean).join(" ");
  sqlite
    .prepare("INSERT INTO search_fts (text, kind, ref_id) VALUES (?, 'plant', ?)")
    .run(text, id);
}

export function removeFromIndex(kind: SearchKind, refId: string) {
  sqlite.prepare("DELETE FROM search_fts WHERE kind = ? AND ref_id = ?").run(kind, refId);
}

export function searchIndex(kind: SearchKind, query: string): string[] {
  // FTS5-Sonderzeichen im Nutzer-Query neutralisieren, dann als Prefix-Suche pro Wort
  const sanitized = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"*`)
    .join(" ");
  if (!sanitized) return [];

  const rows = sqlite
    .prepare(
      "SELECT ref_id FROM search_fts WHERE kind = ? AND text MATCH ? ORDER BY rank",
    )
    .all(kind, sanitized) as { ref_id: string }[];
  return rows.map((r) => r.ref_id);
}
