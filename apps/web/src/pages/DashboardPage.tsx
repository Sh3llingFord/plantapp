import { useEffect, useMemo, useState } from "react";
import { matchLocation, isSowableInMonth, currentMonthNameDe } from "@plantapp/shared";
import { api, TASK_LABELS, type Task, type Plant, type Location, type Species, type WeatherWarnings } from "../api";

const CURRENT_MONTH = currentMonthNameDe();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [warnings, setWarnings] = useState<WeatherWarnings | null>(null);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sowableSpecies, setSowableSpecies] = useState<Species[] | null>(null);

  function load() {
    const from = new Date();
    from.setDate(from.getDate() - 14);
    api.tasks
      .list({ from: from.toISOString(), to: new Date().toISOString() })
      .then((all) => setTasks(all.filter((t) => t.status === "pending")))
      .catch(() => setTasks([]));
    api.weather.warnings().then(setWarnings).catch(() => setWarnings(null));
    api.plants.list().then(setPlants).catch(() => setPlants([]));
    api.locations.list().then(setLocations).catch(() => setLocations([]));
    api.species.list().then(setSowableSpecies).catch(() => setSowableSpecies([]));
  }

  useEffect(load, []);

  async function handleAction(taskId: string, status: "done" | "skipped" | "later") {
    await api.tasks.update(taskId, status);
    load();
  }

  const mismatchedPlants = useMemo(() => {
    if (!plants) return [];
    return plants.filter((p) => {
      if (!p.locationId || !p.speciesCareProfile) return false;
      const location = locations.find((l) => l.id === p.locationId);
      if (!location) return false;
      return matchLocation(p.speciesCareProfile, location).tier === "bad";
    });
  }, [plants, locations]);

  const sowableNow = useMemo(() => {
    if (!sowableSpecies) return [];
    return sowableSpecies.filter((s) => isSowableInMonth(s.careProfile.sowing, CURRENT_MONTH));
  }, [sowableSpecies]);

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    return [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks]);

  const hasWarning = warnings && (warnings.frost.active || warnings.heat.active || warnings.rain.active);

  return (
    <div className="app-content">
      {hasWarning && (
        <div className="detail-card">
          <p className="section__title">
            <span aria-hidden="true">⚠️</span> Wetter
          </p>
          {warnings!.frost.active && (
            <p className="alert alert--error" style={{ marginBottom: 8 }}>
              🥶 Frostwarnung — Tiefstwert {warnings!.frost.tempMinC?.toFixed(0)}°C in 48h.{" "}
              {warnings!.frost.atRiskPlants.length > 0 &&
                `Betroffen: ${warnings!.frost.atRiskPlants.map((p) => p.nickname).join(", ")}.`}
            </p>
          )}
          {warnings!.heat.active && (
            <p className="alert alert--error" style={{ marginBottom: 8 }}>
              ☀️ Hitzewarnung — heute bis zu {warnings!.heat.tempMaxC?.toFixed(0)}°C. Kübelpflanzen
              im Freien ggf. zusätzlich gießen.
            </p>
          )}
          {warnings!.rain.active && (
            <p className="section__status">
              🌧️ {warnings!.rain.mm?.toFixed(0)}mm Regen heute — Gießaufgaben an Außenstandorten
              wurden automatisch verschoben.
            </p>
          )}
        </div>
      )}

      <div className="detail-card">
        <p className="section__title">
          <span aria-hidden="true">📋</span> Heute &amp; überfällig
        </p>
        {tasks === null && <p>lädt…</p>}
        {tasks && sortedTasks.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>Nichts fällig — gut gemacht.</p>
        )}
        {sortedTasks.length > 0 && (
          <div className="list">
            {sortedTasks.map((task) => (
              <div key={task.id} className="list-item" style={{ cursor: "default" }}>
                {task.plantPhotoPath ? (
                  <img className="list-item__thumb" src={task.plantPhotoPath} alt="" />
                ) : (
                  <span className="list-item__thumb" aria-hidden="true">
                    🪴
                  </span>
                )}
                <div className="list-item__body">
                  <div className="list-item__title">{task.plantNickname}</div>
                  <div className="list-item__subtitle">
                    {TASK_LABELS[task.type]}
                    {task.dueDate.slice(0, 10) < todayStr() ? " · überfällig" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn btn--primary"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                    onClick={() => handleAction(task.id, "done")}
                    title="Erledigt"
                  >
                    ✓
                  </button>
                  <button
                    className="btn btn--secondary"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                    onClick={() => handleAction(task.id, "later")}
                    title="Später"
                  >
                    ⏰
                  </button>
                  <button
                    className="btn btn--ghost"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                    onClick={() => handleAction(task.id, "skipped")}
                    title="Übersprungen"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mismatchedPlants.length > 0 && (
        <div className="detail-card">
          <p className="section__title">
            <span aria-hidden="true">📍</span> Standort-Check
          </p>
          <p>
            {mismatchedPlants.length} Pflanze{mismatchedPlants.length > 1 ? "n" : ""} passt
            aktuell nicht optimal zum Standort: {mismatchedPlants.map((p) => p.nickname).join(", ")}.
          </p>
        </div>
      )}

      {sowableNow.length > 0 && (
        <div className="detail-card">
          <p className="section__title">
            <span aria-hidden="true">🌰</span> Diesen Monat säbar
          </p>
          <p>
            {sowableNow
              .slice(0, 6)
              .map((s) => s.careProfile.identity.commonNamesDe?.[0] ?? s.botanicalName)
              .join(", ")}
            {sowableNow.length > 6 ? ` und ${sowableNow.length - 6} weitere` : ""} — siehe Katalog-Filter
            für Details.
          </p>
        </div>
      )}
    </div>
  );
}
