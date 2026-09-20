import { useEffect, useState } from "react";
import { api, type Species } from "../api";
import { CareProfileView } from "../care-profile-view";

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
        <span className="detail-photo__hint">
          <span aria-hidden="true">📷</span> {entry.photoPath ? "Foto ändern" : "Foto hinzufügen"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
