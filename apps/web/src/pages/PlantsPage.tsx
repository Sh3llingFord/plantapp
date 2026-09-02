import { useEffect, useState } from "react";
import { api, type Plant } from "../api";
import { ToxicityBadges } from "../toxicity";

export function PlantsPage({ onOpenPlant }: { onOpenPlant: (id: string) => void }) {
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      api.plants
        .list({ q: q || undefined })
        .then(setPlants)
        .catch(() => setPlants([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="app-content">
      <div className="search-bar">
        <span aria-hidden="true">🔍</span>
        <input
          type="search"
          placeholder="Eigene Pflanzen durchsuchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {plants === null && <p>lädt…</p>}

      {plants?.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            🌱
          </span>
          <p>
            {q
              ? "Keine Pflanze gefunden."
              : "Noch keine Pflanze angelegt. Tippe unten rechts auf + zum Anlegen."}
          </p>
        </div>
      )}

      {plants && plants.length > 0 && (
        <div className="list">
          {plants.map((plant) => (
            <button
              key={plant.id}
              type="button"
              className="list-item"
              onClick={() => onOpenPlant(plant.id)}
            >
              {plant.photoPath ? (
                <img className="list-item__thumb" src={plant.photoPath} alt="" />
              ) : (
                <span className="list-item__thumb" aria-hidden="true">
                  🪴
                </span>
              )}
              <div className="list-item__body">
                <div className="list-item__title">{plant.nickname}</div>
                {(plant.speciesBotanicalName || plant.freeTextSpecies) && (
                  <div className="list-item__subtitle">
                    {plant.speciesBotanicalName ?? plant.freeTextSpecies}
                  </div>
                )}
              </div>
              <ToxicityBadges toxicity={plant.speciesCareProfile?.toxicity} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
