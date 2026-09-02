import { useEffect, useState } from "react";
import { api, LIGHT_LABELS, type PlantDetail, type Location } from "../api";
import { ToxicityBanner } from "../toxicity";

export function PlantDetailPage({
  id,
  onEdit,
  onDeleted,
}: {
  id: string;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [uploading, setUploading] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);

  function load() {
    api.plants.get(id).then((p) => {
      setPlant(p);
      if (p.locationId) {
        api.locations.list().then((locs) => {
          setLocation(locs.find((l) => l.id === p.locationId) ?? null);
        });
      }
    });
  }

  useEffect(load, [id]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.plants.uploadPhoto(id, file);
      load();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`"${plant?.nickname}" wirklich löschen?`)) return;
    await api.plants.remove(id);
    onDeleted();
  }

  async function pollJob(jobId: string, attemptsLeft: number) {
    if (attemptsLeft <= 0) {
      setEnrichStatus("dauert länger als erwartet — später nochmal versuchen");
      return;
    }
    const job = await api.enrichmentJobs.get(jobId);
    if (job.status === "done") {
      setEnrichStatus("Pflegeprofil gefunden ✓");
      load();
      return;
    }
    if (job.status === "failed") {
      setEnrichStatus(job.error ?? "Recherche fehlgeschlagen");
      return;
    }
    setTimeout(() => pollJob(jobId, attemptsLeft - 1), 4000);
  }

  async function handleEnrich() {
    setEnrichStatus("recherchiere…");
    try {
      const result = await api.plants.enrich(id);
      if (result.status === "done") {
        setEnrichStatus("Pflegeprofil gefunden ✓");
        load();
      } else if (result.jobId) {
        setEnrichStatus("angefragt — n8n recherchiert im Hintergrund…");
        pollJob(result.jobId, 30);
      } else {
        setEnrichStatus("n8n ist noch nicht angebunden");
      }
    } catch (err) {
      setEnrichStatus(err instanceof Error ? err.message : "fehlgeschlagen");
    }
  }

  if (!plant) return <div className="app-content">lädt…</div>;

  const care = plant.careProfile;

  return (
    <div className="app-content">
      <label className="detail-photo" style={{ cursor: "pointer", position: "relative" }}>
        {plant.photoPath ? (
          <img
            src={plant.photoPath}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          />
        ) : (
          <span aria-hidden="true">{uploading ? "…" : "🪴"}</span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          style={{ display: "none" }}
          onChange={handlePhotoChange}
        />
      </label>

      <div>
        <h2 style={{ margin: "0 0 4px" }}>{plant.nickname}</h2>
        {(plant.speciesBotanicalName || plant.freeTextSpecies) && (
          <p style={{ fontStyle: "italic" }}>{plant.speciesBotanicalName ?? plant.freeTextSpecies}</p>
        )}
      </div>

      <ToxicityBanner toxicity={care?.toxicity} />

      <div className="detail-card">
        <dl className="kv-list">
          {location && <div className="kv-row"><dt>Standort</dt><dd>{location.name}</dd></div>}
          {plant.purchaseDate && (
            <div className="kv-row">
              <dt>Gekauft am</dt>
              <dd>{new Date(plant.purchaseDate).toLocaleDateString("de-DE")}</dd>
            </div>
          )}
          {care?.placement?.light && (
            <div className="kv-row"><dt>Licht</dt><dd>{LIGHT_LABELS[care.placement.light]}</dd></div>
          )}
        </dl>
      </div>

      {plant.notes && (
        <div className="detail-card">
          <p className="section__title">
            <span aria-hidden="true">📝</span> Notizen
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{plant.notes}</p>
        </div>
      )}

      {care?.water && (
        <div className="detail-card">
          <p className="section__title">
            <span aria-hidden="true">💧</span> Gießen
          </p>
          <p>{care.water.amount}</p>
        </div>
      )}

      {!care && plant.freeTextSpecies && (
        <div className="detail-card">
          <p style={{ color: "var(--color-text-muted)", marginBottom: 10 }}>
            Diese Pflanze ist nicht mit dem Katalog verknüpft, daher gibt es noch kein
            Pflegeprofil.
          </p>
          <button className="btn btn--secondary" onClick={handleEnrich}>
            🔎 Pflegeprofil per KI recherchieren
          </button>
          {enrichStatus && <p className="section__status">{enrichStatus}</p>}
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn--secondary" onClick={onEdit}>
          Bearbeiten
        </button>
        <button className="btn btn--ghost" onClick={handleDelete}>
          Löschen
        </button>
      </div>
    </div>
  );
}
