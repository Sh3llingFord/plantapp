import { useEffect, useState } from "react";
import { api, LIGHT_LABELS, type Species } from "../api";
import type { CareProfile } from "@plantapp/shared";
import { ToxicityBanner } from "../toxicity";

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="detail-card">
      <p className="section__title">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      {children}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="kv-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CareProfileView({ profile }: { profile: CareProfile }) {
  const { placement, water, soil, fertilizer, pruning, repotting, bloom, harvest, propagation, toxicity, size, problems } = profile;

  return (
    <>
      <ToxicityBanner toxicity={toxicity} />

      {placement && (
        <Section title="Standort" icon="☀️">
          <dl className="kv-list">
            <Kv label="Licht" value={placement.light ? LIGHT_LABELS[placement.light] : null} />
            <Kv
              label="Innen/Außen"
              value={[placement.indoor && "Innen", placement.outdoor && "Außen"].filter(Boolean).join(", ")}
            />
            <Kv label="Himmelsrichtung" value={placement.recommendedDirection?.join(", ")} />
            <Kv
              label="Temperatur"
              value={
                placement.temperatureMinC != null || placement.temperatureMaxC != null
                  ? `${placement.temperatureMinC ?? "?"}–${placement.temperatureMaxC ?? "?"} °C`
                  : null
              }
            />
            <Kv label="Winterhart" value={placement.hardy === null ? null : placement.hardy ? `Ja (bis ${placement.hardyToC ?? "?"} °C)` : "Nein"} />
            <Kv label="Winterschutz" value={placement.winterProtection} />
          </dl>
        </Section>
      )}

      {water && (
        <Section title="Gießen" icon="💧">
          <dl className="kv-list">
            <Kv
              label="Intervall (Frühling/Sommer/Herbst/Winter)"
              value={
                water.intervalDaysBySeason
                  ? [
                      water.intervalDaysBySeason.spring,
                      water.intervalDaysBySeason.summer,
                      water.intervalDaysBySeason.autumn,
                      water.intervalDaysBySeason.winter,
                    ]
                      .map((d) => (d == null ? "–" : `${d}T`))
                      .join(" / ")
                  : null
              }
            />
            <Kv label="Menge" value={water.amount} />
            <Kv label="Oberste Schicht abtrocknen lassen" value={water.letTopLayerDryOut === null ? null : water.letTopLayerDryOut ? "Ja" : "Nein"} />
          </dl>
        </Section>
      )}

      {soil && (
        <Section title="Substrat" icon="🪴">
          <dl className="kv-list">
            <Kv label="Substrat" value={soil.substrate} />
            <Kv label="pH" value={soil.phMin != null || soil.phMax != null ? `${soil.phMin ?? "?"}–${soil.phMax ?? "?"}` : null} />
            <Kv label="Drainage" value={soil.drainage} />
          </dl>
        </Section>
      )}

      {fertilizer && (fertilizer.npk || fertilizer.rhythm) && (
        <Section title="Düngen" icon="🌱">
          <dl className="kv-list">
            <Kv label="Dünger" value={fertilizer.npk} />
            <Kv label="Rhythmus" value={fertilizer.rhythm} />
            <Kv label="Zeitfenster" value={fertilizer.seasonWindow?.join(", ")} />
          </dl>
        </Section>
      )}

      {pruning?.windows && pruning.windows.length > 0 && (
        <Section title="Schnitt" icon="✂️">
          <dl className="kv-list">
            {pruning.windows.map((w, i) => (
              <Kv key={i} label={w.type} value={w.months.join(", ")} />
            ))}
          </dl>
        </Section>
      )}

      {repotting && (repotting.everyYears || repotting.bestMonths) && (
        <Section title="Umtopfen" icon="🔄">
          <dl className="kv-list">
            <Kv label="Alle X Jahre" value={repotting.everyYears} />
            <Kv label="Beste Monate" value={repotting.bestMonths?.join(", ")} />
          </dl>
        </Section>
      )}

      {bloom && (bloom.months || bloom.color) && (
        <Section title="Blüte" icon="🌸">
          <dl className="kv-list">
            <Kv label="Monate" value={bloom.months?.join(", ")} />
            <Kv label="Farbe" value={bloom.color} />
            <Kv label="Duftend" value={bloom.fragrant === null ? null : bloom.fragrant ? "Ja" : "Nein"} />
          </dl>
        </Section>
      )}

      {harvest?.months && (
        <Section title="Ernte" icon="🧺">
          <p>{harvest.months.join(", ")}</p>
        </Section>
      )}

      {propagation && (propagation.methods || propagation.bestMonths) && (
        <Section title="Vermehrung" icon="🌿">
          <dl className="kv-list">
            <Kv label="Methoden" value={propagation.methods?.join(", ")} />
            <Kv label="Beste Monate" value={propagation.bestMonths?.join(", ")} />
          </dl>
        </Section>
      )}

      {size && (
        <Section title="Größe" icon="📏">
          <dl className="kv-list">
            <Kv
              label="Höhe"
              value={size.heightMinCm != null || size.heightMaxCm != null ? `${size.heightMinCm ?? "?"}–${size.heightMaxCm ?? "?"} cm` : null}
            />
            <Kv
              label="Breite"
              value={size.widthMinCm != null || size.widthMaxCm != null ? `${size.widthMinCm ?? "?"}–${size.widthMaxCm ?? "?"} cm` : null}
            />
            <Kv label="Wuchstempo" value={size.growthRate} />
          </dl>
        </Section>
      )}

      {problems && problems.length > 0 && (
        <Section title="Häufige Probleme" icon="🐛">
          <dl className="kv-list">
            {problems.map((p, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <strong>{p.name}</strong>
                {p.symptoms && <p style={{ margin: "2px 0" }}>{p.symptoms}</p>}
                {p.remedy && <p style={{ margin: "2px 0", color: "var(--color-primary-dark)" }}>→ {p.remedy}</p>}
              </div>
            ))}
          </dl>
        </Section>
      )}

      {profile.meta.sources && profile.meta.sources.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Quellen: {profile.meta.sources.join(", ")}
        </p>
      )}
    </>
  );
}

export function SpeciesDetailPage({
  id,
  onAddedToMyPlants,
}: {
  id: string;
  onAddedToMyPlants: (plantId: string) => void;
}) {
  const [entry, setEntry] = useState<Species | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);

  function load() {
    api.species.get(id).then(setEntry);
  }

  useEffect(load, [id]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.species.uploadPhoto(id, file);
      load();
    } finally {
      setUploading(false);
    }
  }

  async function handleAddToMyPlants() {
    if (!entry) return;
    setAdding(true);
    try {
      const nickname = entry.careProfile.identity.commonNamesDe?.[0] ?? entry.botanicalName;
      const plant = await api.plants.create({ nickname, speciesId: entry.id });
      onAddedToMyPlants(plant.id);
    } finally {
      setAdding(false);
    }
  }

  if (!entry) return <div className="app-content">lädt…</div>;

  const { careProfile } = entry;

  return (
    <div className="app-content">
      <label className="detail-photo" style={{ cursor: "pointer", position: "relative" }}>
        {entry.photoPath ? (
          <img
            src={entry.photoPath}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          />
        ) : (
          <span aria-hidden="true">{uploading ? "…" : "🌿"}</span>
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
        <h2 style={{ margin: "0 0 4px" }}>
          {careProfile.identity.commonNamesDe?.[0] ?? entry.botanicalName}
        </h2>
        <p style={{ fontStyle: "italic" }}>{entry.botanicalName}</p>
      </div>

      <button className="btn btn--primary" onClick={handleAddToMyPlants} disabled={adding}>
        {adding ? "…" : "🪴 Zu meinen Pflanzen hinzufügen"}
      </button>

      <CareProfileView profile={careProfile} />
    </div>
  );
}
