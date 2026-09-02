import { useEffect, useState } from "react";
import { api, LIGHT_LABELS, type Species } from "../api";
import type { LightLevel } from "@plantapp/shared";
import { ToxicityBadges } from "../toxicity";

const LIGHT_FILTERS: LightLevel[] = ["full_sun", "partial_sun", "bright_indirect", "shade"];

export function CatalogPage({ onOpenSpecies }: { onOpenSpecies: (id: string) => void }) {
  const [list, setList] = useState<Species[] | null>(null);
  const [q, setQ] = useState("");
  const [light, setLight] = useState<LightLevel | null>(null);
  const [hardyOnly, setHardyOnly] = useState(false);
  const [petSafeOnly, setPetSafeOnly] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      api.species
        .list({
          q: q || undefined,
          light: light ?? undefined,
          hardy: hardyOnly ? "true" : undefined,
          petsToxic: petSafeOnly ? "false" : undefined,
        })
        .then(setList)
        .catch(() => setList([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, light, hardyOnly, petSafeOnly]);

  return (
    <div className="app-content">
      <div className="search-bar">
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          placeholder="Katalog durchsuchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="chip-row">
        {LIGHT_FILTERS.map((level) => (
          <button
            key={level}
            type="button"
            className={`chip ${light === level ? "chip--active" : ""}`}
            onClick={() => setLight(light === level ? null : level)}
          >
            {LIGHT_LABELS[level]}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${hardyOnly ? "chip--active" : ""}`}
          onClick={() => setHardyOnly((v) => !v)}
        >
          winterhart
        </button>
        <button
          type="button"
          className={`chip ${petSafeOnly ? "chip--active" : ""}`}
          onClick={() => setPetSafeOnly((v) => !v)}
        >
          haustierunbedenklich
        </button>
      </div>

      {list === null && <p>lädt…</p>}
      {list?.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            📖
          </span>
          <p>Keine Pflanze gefunden.</p>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="list">
          {list.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="list-item"
              onClick={() => onOpenSpecies(entry.id)}
            >
              {entry.photoPath ? (
                <img className="list-item__thumb" src={entry.photoPath} alt="" />
              ) : (
                <span className="list-item__thumb" aria-hidden="true">
                  🌿
                </span>
              )}
              <div className="list-item__body">
                <div className="list-item__title">
                  {entry.careProfile.identity.commonNamesDe?.[0] ?? entry.botanicalName}
                </div>
                <div className="list-item__subtitle">{entry.botanicalName}</div>
              </div>
              <ToxicityBadges toxicity={entry.careProfile.toxicity} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
