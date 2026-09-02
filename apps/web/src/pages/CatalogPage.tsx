import { useEffect, useMemo, useState } from "react";
import { api, LIGHT_LABELS, type Species, type Location } from "../api";
import { currentMonthNameDe, isSowableInMonth, matchLocation, type LightLevel } from "@plantapp/shared";
import { ToxicityBadges } from "../toxicity";

const LIGHT_FILTERS: LightLevel[] = ["full_sun", "partial_sun", "bright_indirect", "shade"];
const CURRENT_MONTH = currentMonthNameDe();
const TIER_ICON = { good: "🟢", partial: "🟡", bad: "🔴", unknown: "" } as const;

export function CatalogPage({
  onOpenSpecies,
  onOpenGardenPlans,
}: {
  onOpenSpecies: (id: string) => void;
  onOpenGardenPlans: () => void;
}) {
  const [list, setList] = useState<Species[] | null>(null);
  const [q, setQ] = useState("");
  const [light, setLight] = useState<LightLevel | null>(null);
  const [hardyOnly, setHardyOnly] = useState(false);
  const [petSafeOnly, setPetSafeOnly] = useState(false);
  const [sowableOnly, setSowableOnly] = useState(false);
  const [outdoorLocations, setOutdoorLocations] = useState<Location[]>([]);
  const [bedLocationId, setBedLocationId] = useState<string>("");

  useEffect(() => {
    api.locations.list().then((locs) => setOutdoorLocations(locs.filter((l) => !l.indoor)));
  }, []);

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

  const visibleList = useMemo(() => {
    if (!list) return list;
    if (!sowableOnly) return list;
    return list.filter((entry) => isSowableInMonth(entry.careProfile.sowing, CURRENT_MONTH));
  }, [list, sowableOnly]);

  return (
    <div className="app-content">
      <button className="btn btn--secondary" style={{ marginBottom: 12 }} onClick={onOpenGardenPlans}>
        🗺️ Meine Beetpläne
      </button>

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
        <button
          type="button"
          className={`chip ${sowableOnly ? "chip--active" : ""}`}
          onClick={() => setSowableOnly((v) => !v)}
        >
          🌰 diesen Monat säbar
        </button>
      </div>

      {sowableOnly && (
        <>
          <p className="section__status" style={{ marginBottom: 8 }}>
            Aussaat-, Direktsaat- oder Auspflanzfenster für {CURRENT_MONTH} — unabhängig vom
            eigenen Bestand, reine Planungshilfe.
          </p>
          {outdoorLocations.length > 0 && (
            <div className="field" style={{ marginBottom: 10 }}>
              <label htmlFor="bedLocation">Für welches Beet?</label>
              <select
                id="bedLocation"
                className="select"
                value={bedLocationId}
                onChange={(e) => setBedLocationId(e.target.value)}
              >
                <option value="">– beliebig –</option>
                {outdoorLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {visibleList === null && <p>lädt…</p>}
      {visibleList?.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            📖
          </span>
          <p>{sowableOnly ? `Für ${CURRENT_MONTH} ist nichts hinterlegt.` : "Keine Pflanze gefunden."}</p>
        </div>
      )}

      {visibleList && visibleList.length > 0 && (
        <div className="list">
          {visibleList.map((entry) => (
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
              {sowableOnly && bedLocationId && (() => {
                const bed = outdoorLocations.find((l) => l.id === bedLocationId);
                if (!bed) return null;
                const { tier } = matchLocation(entry.careProfile, bed);
                return tier === "unknown" ? null : (
                  <span aria-hidden="true" style={{ fontSize: 16 }}>{TIER_ICON[tier]}</span>
                );
              })()}
              <ToxicityBadges toxicity={entry.careProfile.toxicity} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
