import { useEffect, useState } from "react";
import { api, type GardenPlan } from "../api";

const MIN_SIZE = 2;
const MAX_SIZE = 30;

export function GardenPlansPage({ onOpenPlan }: { onOpenPlan: (id: string) => void }) {
  const [plans, setPlans] = useState<GardenPlan[] | null>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.gardenPlans.list().then(setPlans).catch(() => setPlans([]));
  }

  useEffect(load, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Bitte einen Namen eingeben");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const plan = await api.gardenPlans.create({ name: name.trim(), rows, cols });
      setName("");
      onOpenPlan(plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app-content">
      <div className="detail-card">
        <p className="section__title">
          <span aria-hidden="true">➕</span> Neuer Plan
        </p>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="planName">Name</label>
            <input
              id="planName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Hochbeet Süd"
              disabled={creating}
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="planRows">Zeilen</label>
              <input
                id="planRows"
                type="number"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                disabled={creating}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="planCols">Spalten</label>
              <input
                id="planCols"
                type="number"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={cols}
                onChange={(e) => setCols(Number(e.target.value))}
                disabled={creating}
              />
            </div>
          </div>
          <p className="section__status" style={{ marginBottom: 10 }}>
            Zwischen {MIN_SIZE}×{MIN_SIZE} und {MAX_SIZE}×{MAX_SIZE}.
          </p>
          {error && <p className="alert alert--error">{error}</p>}
          <button className="btn btn--primary" type="submit" disabled={creating}>
            {creating ? "Lege an…" : "Plan anlegen"}
          </button>
        </form>
      </div>

      {plans === null && <p>lädt…</p>}

      {plans?.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            🗺️
          </span>
          <p>Noch kein Beetplan angelegt.</p>
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="list">
          {plans.map((plan) => (
            <button key={plan.id} type="button" className="list-item" onClick={() => onOpenPlan(plan.id)}>
              <span className="list-item__thumb" aria-hidden="true">
                🗺️
              </span>
              <div className="list-item__body">
                <div className="list-item__title">{plan.name}</div>
                <div className="list-item__subtitle">
                  {plan.rows}×{plan.cols} Felder
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
