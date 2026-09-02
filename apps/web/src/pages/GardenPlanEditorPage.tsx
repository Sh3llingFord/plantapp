import { useEffect, useMemo, useState } from "react";
import { checkCompanionPair, type CompanionCheckStatus } from "@plantapp/shared";
import { api, type GardenPlanDetail, type GardenPlanCell, type Species } from "../api";

interface Pair {
  a: { row: number; col: number; name: string };
  b: { row: number; col: number; name: string };
  status: Exclude<CompanionCheckStatus, "neutral">;
}

function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function displayName(care: { identity: { commonNamesDe: string[] | null; botanicalName: string } }): string {
  return care.identity.commonNamesDe?.[0] ?? care.identity.botanicalName;
}

export function GardenPlanEditorPage({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [plan, setPlan] = useState<GardenPlanDetail | null>(null);
  const [pickerCell, setPickerCell] = useState<{ row: number; col: number } | null>(null);
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [speciesResults, setSpeciesResults] = useState<Species[]>([]);
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [checking, setChecking] = useState(false);

  function load() {
    api.gardenPlans.get(id).then(setPlan);
  }

  useEffect(load, [id]);

  useEffect(() => {
    if (!speciesQuery) {
      setSpeciesResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.species.list({ q: speciesQuery }).then(setSpeciesResults);
    }, 200);
    return () => clearTimeout(handle);
  }, [speciesQuery]);

  const cellMap = useMemo(() => {
    const map = new Map<string, GardenPlanCell>();
    if (plan) for (const cell of plan.cells) map.set(cellKey(cell.row, cell.col), cell);
    return map;
  }, [plan]);

  async function handlePickSpecies(speciesId: string | null) {
    if (!plan || !pickerCell) return;
    await api.gardenPlans.setCell(plan.id, pickerCell.row, pickerCell.col, speciesId);
    setPickerCell(null);
    setSpeciesQuery("");
    setSpeciesResults([]);
    setPairs(null);
    load();
  }

  async function handleDelete() {
    if (!plan || !confirm(`Plan "${plan.name}" wirklich löschen?`)) return;
    await api.gardenPlans.remove(plan.id);
    onDeleted();
  }

  function handleCheck() {
    if (!plan) return;
    setChecking(true);
    const found: Pair[] = [];
    const seen = new Set<string>();

    for (const cell of plan.cells) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          const neighbor = cellMap.get(cellKey(nr, nc));
          if (!neighbor) continue;

          const pairKey = [cellKey(cell.row, cell.col), cellKey(nr, nc)].sort().join("|");
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);

          const status = checkCompanionPair(cell.speciesCareProfile, neighbor.speciesCareProfile);
          if (status === "neutral") continue;
          found.push({
            a: { row: cell.row, col: cell.col, name: displayName(cell.speciesCareProfile) },
            b: { row: nr, col: nc, name: displayName(neighbor.speciesCareProfile) },
            status,
          });
        }
      }
    }

    setPairs(found);
    setChecking(false);
  }

  const badCells = useMemo(() => {
    const set = new Set<string>();
    for (const p of pairs ?? []) {
      if (p.status === "bad") {
        set.add(cellKey(p.a.row, p.a.col));
        set.add(cellKey(p.b.row, p.b.col));
      }
    }
    return set;
  }, [pairs]);

  const goodCells = useMemo(() => {
    const set = new Set<string>();
    for (const p of pairs ?? []) {
      if (p.status === "good") {
        set.add(cellKey(p.a.row, p.a.col));
        set.add(cellKey(p.b.row, p.b.col));
      }
    }
    return set;
  }, [pairs]);

  if (!plan) return <div className="app-content">lädt…</div>;

  const badPairs = pairs?.filter((p) => p.status === "bad") ?? [];
  const goodPairs = pairs?.filter((p) => p.status === "good") ?? [];

  return (
    <div className="app-content">
      <div className="garden-grid-scroll">
        <div
          className="garden-grid"
          style={{ gridTemplateColumns: `repeat(${plan.cols}, 32px)` }}
        >
          {Array.from({ length: plan.rows }).map((_, row) =>
            Array.from({ length: plan.cols }).map((_, col) => {
              const cell = cellMap.get(cellKey(row, col));
              const key = cellKey(row, col);
              const cls = badCells.has(key)
                ? "garden-cell garden-cell--bad"
                : goodCells.has(key)
                  ? "garden-cell garden-cell--good"
                  : "garden-cell";
              return (
                <button
                  key={key}
                  type="button"
                  className={cls}
                  title={cell ? displayName(cell.speciesCareProfile) : "leer"}
                  onClick={() => setPickerCell({ row, col })}
                >
                  {cell ? (
                    cell.speciesPhotoPath ? (
                      <img src={cell.speciesPhotoPath} alt="" />
                    ) : (
                      <span aria-hidden="true">🌿</span>
                    )
                  ) : (
                    <span aria-hidden="true" style={{ opacity: 0.3 }}>
                      ·
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn--primary" onClick={handleCheck} disabled={checking}>
          🔍 Prüfen
        </button>
        <button className="btn btn--ghost" onClick={handleDelete}>
          Plan löschen
        </button>
      </div>

      {pairs && (
        <div className="detail-card">
          <p className="section__title">Ergebnis</p>
          {badPairs.length === 0 && goodPairs.length === 0 && (
            <p style={{ color: "var(--color-text-muted)" }}>
              Keine bekannten Konflikte oder Empfehlungen zwischen den platzierten Pflanzen —
              entweder passt alles neutral zueinander, oder es liegen für diese Kombinationen
              keine Mischkultur-Daten vor.
            </p>
          )}
          {badPairs.map((p, i) => (
            <p key={`bad-${i}`} className="alert alert--error" style={{ marginBottom: 6 }}>
              ⚠️ Reihe {p.a.row + 1}, Spalte {p.a.col + 1} ({p.a.name}) verträgt sich laut
              Recherche nicht mit Reihe {p.b.row + 1}, Spalte {p.b.col + 1} ({p.b.name}).
            </p>
          ))}
          {goodPairs.map((p, i) => (
            <p key={`good-${i}`} style={{ color: "var(--color-success-text)", marginBottom: 6 }}>
              ✓ Reihe {p.a.row + 1}, Spalte {p.a.col + 1} ({p.a.name}) passt laut Recherche gut zu
              Reihe {p.b.row + 1}, Spalte {p.b.col + 1} ({p.b.name}).
            </p>
          ))}
        </div>
      )}

      {pickerCell && (
        <div className="modal-overlay" onClick={() => setPickerCell(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <p className="section__title">
              Feld Reihe {pickerCell.row + 1}, Spalte {pickerCell.col + 1}
            </p>
            {cellMap.has(cellKey(pickerCell.row, pickerCell.col)) && (
              <button className="btn btn--ghost" style={{ marginBottom: 10 }} onClick={() => handlePickSpecies(null)}>
                ✕ Feld leeren
              </button>
            )}
            <input
              placeholder="Katalog durchsuchen…"
              value={speciesQuery}
              onChange={(e) => setSpeciesQuery(e.target.value)}
              autoFocus
            />
            <div className="list" style={{ marginTop: 8 }}>
              {speciesResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="list-item"
                  onClick={() => handlePickSpecies(s.id)}
                >
                  <span className="list-item__thumb" aria-hidden="true">
                    🌿
                  </span>
                  <div className="list-item__body">
                    <div className="list-item__title">{displayName(s.careProfile)}</div>
                    <div className="list-item__subtitle">{s.botanicalName}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
