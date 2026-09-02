import { useEffect, useState } from "react";
import { api, type Location, type Species } from "../api";

interface Props {
  plantId: string | null; // null = neue Pflanze
  onSaved: (id: string) => void;
  onCancel: () => void;
}

export function PlantFormPage({ plantId, onSaved, onCancel }: Props) {
  const [nickname, setNickname] = useState("");
  const [speciesQuery, setSpeciesQuery] = useState("");
  const [speciesResults, setSpeciesResults] = useState<Species[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null);
  const [freeTextSpecies, setFreeTextSpecies] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [newLocationName, setNewLocationName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.locations.list().then(setLocations);
  }, []);

  useEffect(() => {
    if (!plantId) return;
    api.plants.get(plantId).then((p) => {
      setNickname(p.nickname);
      setFreeTextSpecies(p.freeTextSpecies ?? "");
      setLocationId(p.locationId ?? "");
      setPurchaseDate(p.purchaseDate ? p.purchaseDate.slice(0, 10) : "");
      setNotes(p.notes ?? "");
      if (p.speciesId) api.species.get(p.speciesId).then(setSelectedSpecies);
    });
  }, [plantId]);

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

  async function handleCreateLocation() {
    if (!newLocationName.trim()) return;
    const loc = await api.locations.create({ name: newLocationName.trim(), indoor: true });
    setLocations((prev) => [...prev, loc]);
    setLocationId(loc.id);
    setNewLocationName("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) {
      setError("Bitte einen Spitznamen eingeben");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        nickname: nickname.trim(),
        speciesId: selectedSpecies?.id ?? null,
        freeTextSpecies: selectedSpecies ? null : freeTextSpecies.trim() || null,
        locationId: locationId || null,
        purchaseDate: purchaseDate || null,
        notes: notes.trim() || null,
      };
      const saved = plantId ? await api.plants.update(plantId, body) : await api.plants.create(body);
      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-content">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="nickname">Spitzname</label>
          <input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
        </div>

        <div className="field">
          <label>Art</label>
          {selectedSpecies ? (
            <div className="list-item" style={{ cursor: "default" }}>
              <span className="list-item__thumb" aria-hidden="true">🌿</span>
              <div className="list-item__body">
                <div className="list-item__title">
                  {selectedSpecies.careProfile.identity.commonNamesDe?.[0] ?? selectedSpecies.botanicalName}
                </div>
                <div className="list-item__subtitle">{selectedSpecies.botanicalName}</div>
              </div>
              <button type="button" className="btn btn--ghost" style={{ width: "auto" }} onClick={() => setSelectedSpecies(null)}>
                ✕
              </button>
            </div>
          ) : (
            <>
              <input
                placeholder="Katalog durchsuchen…"
                value={speciesQuery}
                onChange={(e) => setSpeciesQuery(e.target.value)}
              />
              {speciesResults.length > 0 && (
                <div className="list" style={{ marginTop: 8 }}>
                  {speciesResults.slice(0, 5).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="list-item"
                      onClick={() => {
                        setSelectedSpecies(s);
                        setSpeciesQuery("");
                        setSpeciesResults([]);
                      }}
                    >
                      <span className="list-item__thumb" aria-hidden="true">🌿</span>
                      <div className="list-item__body">
                        <div className="list-item__title">
                          {s.careProfile.identity.commonNamesDe?.[0] ?? s.botanicalName}
                        </div>
                        <div className="list-item__subtitle">{s.botanicalName}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, margin: "6px 0" }}>
                Nicht im Katalog? Freien Namen eintragen:
              </p>
              <input
                placeholder="z.B. unbekannte Pflanze vom Markt"
                value={freeTextSpecies}
                onChange={(e) => setFreeTextSpecies(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="field">
          <label htmlFor="location">Standort</label>
          <select
            id="location"
            className="select"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">– kein Standort –</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input
              placeholder="Neuer Standort…"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
            />
            <button type="button" className="btn btn--secondary" style={{ width: "auto" }} onClick={handleCreateLocation}>
              +
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="purchaseDate">Kaufdatum</label>
          <input
            id="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="notes">Notizen</label>
          <textarea
            id="notes"
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="alert alert--error">{error}</p>}

        <div className="btn-row">
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? "Speichert…" : "Speichern"}
          </button>
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
