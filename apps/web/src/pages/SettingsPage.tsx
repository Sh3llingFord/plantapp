import { useEffect, useState } from "react";
import { enableNotifications, sendTestNotification } from "../push";
import { api, type UserSettings, type WeatherLocation, type WeatherDay } from "../api";

interface User {
  username: string;
}

export function SettingsPage({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const [health, setHealth] = useState<"prüfe…" | "ok" | "nicht erreichbar">("prüfe…");
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [forecast, setForecast] = useState<WeatherDay[] | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status === "ok" ? "ok" : "nicht erreichbar"))
      .catch(() => setHealth("nicht erreichbar"));
    api.settings.get().then(setSettings);
    api.weather.getLocation().then(setLocation);
    api.weather.forecast().then(setForecast).catch(() => setForecast([]));
  }, []);

  async function handleSaveLocation() {
    if (!locationInput.trim()) return;
    setSavingLocation(true);
    setLocationStatus("suche…");
    try {
      const updated = await api.weather.setLocation(locationInput.trim());
      setLocation(updated);
      setLocationStatus(`gesetzt: ${updated.locationName}`);
      setLocationInput("");
      api.weather.forecast().then(setForecast).catch(() => {});
    } catch (err) {
      setLocationStatus(err instanceof Error ? err.message : "fehlgeschlagen");
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleEnableNotifications() {
    setPushStatus("aktiviere…");
    try {
      await enableNotifications();
      setPushStatus("aktiviert ✓");
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : "fehlgeschlagen");
    }
  }

  async function handleTestNotification() {
    setPushStatus("sende…");
    try {
      const { sent, failed } = await sendTestNotification();
      setPushStatus(`gesendet: ${sent}, fehlgeschlagen: ${failed}`);
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : "fehlgeschlagen");
    }
  }

  async function updateSettings(patch: Partial<UserSettings>) {
    setSavingSettings(true);
    try {
      const updated = await api.settings.update(patch);
      setSettings(updated);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onLoggedOut();
  }

  return (
    <div className="app-content">
      <div className="detail-card">
        <div className="settings-header">
          <p className="settings-header__welcome">
            Eingeloggt als <strong>{user.username}</strong>
          </p>
          <span className={`tag ${health === "ok" ? "tag--ok" : "tag--muted"}`}>
            {health === "ok" ? "● online" : health === "prüfe…" ? "…" : "● offline"}
          </span>
        </div>

        <div className="section">
          <p className="section__title">
            <span aria-hidden="true">🔔</span> Benachrichtigungen
          </p>
          <div className="btn-row">
            <button className="btn btn--primary" onClick={handleEnableNotifications}>
              Benachrichtigungen aktivieren
            </button>
            <button className="btn btn--secondary" onClick={handleTestNotification}>
              Testbenachrichtigung senden
            </button>
          </div>
          {pushStatus && <p className="section__status">{pushStatus}</p>}
        </div>

        {settings && (
          <div className="section">
            <p className="section__title">
              <span aria-hidden="true">📋</span> Tägliche Zusammenfassung
            </p>
            <div className="field" style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={settings.dailyDigestEnabled}
                  disabled={savingSettings}
                  onChange={(e) => updateSettings({ dailyDigestEnabled: e.target.checked })}
                />
                Tägliche Zusammenfassung statt einzelner Benachrichtigungen
              </label>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="quietStart">Ruhezeit ab</label>
                <input
                  id="quietStart"
                  type="time"
                  value={settings.quietHoursStart}
                  disabled={savingSettings}
                  onChange={(e) => updateSettings({ quietHoursStart: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="quietEnd">bis</label>
                <input
                  id="quietEnd"
                  type="time"
                  value={settings.quietHoursEnd}
                  disabled={savingSettings}
                  onChange={(e) => updateSettings({ quietHoursEnd: e.target.value })}
                />
              </div>
            </div>
            <p className="section__status">
              Außerhalb dieses Zeitfensters kommt keine Zusammenfassung an.
            </p>
          </div>
        )}

        <div className="section">
          <p className="section__title">
            <span aria-hidden="true">🌦️</span> Standort &amp; Wetter
          </p>
          <p className="section__status" style={{ marginBottom: 8 }}>
            {location?.locationName
              ? `Aktuell: ${location.locationName}`
              : "Noch kein Standort gesetzt — Frost-, Regen- und Hitzewarnungen sind erst danach aktiv."}
          </p>
          <div className="field" style={{ marginBottom: 8 }}>
            <label htmlFor="locationInput">Ortsname</label>
            <input
              id="locationInput"
              type="text"
              placeholder="z.B. Berlin"
              value={locationInput}
              disabled={savingLocation}
              onChange={(e) => setLocationInput(e.target.value)}
            />
          </div>
          <div className="btn-row">
            <button className="btn btn--secondary" disabled={savingLocation} onClick={handleSaveLocation}>
              Speichern
            </button>
          </div>
          {locationStatus && <p className="section__status">{locationStatus}</p>}

          {forecast && forecast.length > 0 && (
            <div className="btn-row" style={{ flexWrap: "wrap", marginTop: 10 }}>
              {forecast.slice(0, 5).map((day) => (
                <span key={day.date} className="tag tag--muted">
                  {new Date(day.date).toLocaleDateString("de-DE", { weekday: "short" })}{" "}
                  {Math.round(day.tempMinC)}–{Math.round(day.tempMaxC)}°C
                  {day.precipitationSumMm >= 1 ? ` · ${Math.round(day.precipitationSumMm)}mm` : ""}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <p className="section__title">
            <span aria-hidden="true">❓</span> Häufige Fragen
          </p>
          <details className="faq-item">
            <summary>Wie lege ich eine Pflanze an?</summary>
            <p>
              Über „Meine Pflanzen" → „+": entweder eine Art aus dem Katalog auswählen (Pflegedaten
              sind sofort da) oder einen Namen frei eintragen — dann recherchiert die KI im
              Hintergrund automatisch ein Pflegeprofil dafür.
            </p>
          </details>
          <details className="faq-item">
            <summary>Woher kommen die Pflegedaten?</summary>
            <p>
              Katalog-Einträge sind mit echten Quellen recherchiert. Frei eingetragene Arten werden
              per KI recherchiert; unsichere Werte bleiben leer statt geraten zu werden.
            </p>
          </details>
          <details className="faq-item">
            <summary>Wie funktionieren Aufgaben &amp; Kalender?</summary>
            <p>
              Aus dem Pflegeprofil jeder Pflanze werden automatisch Fälligkeiten erzeugt (Gießen,
              Düngen, Schnitt, Umtopfen, Ernte, Aussäen, Winterschutz). Im Kalender lassen sie sich
              als erledigt/später/übersprungen markieren; die nächste Fälligkeit entsteht dann
              automatisch.
            </p>
          </details>
          <details className="faq-item">
            <summary>Was bedeutet der Standort-Check?</summary>
            <p>
              Auf der Pflanzen-Detailseite und beim Anlegen zeigt eine Ampel (🟢/🟡/🔴), ob Licht,
              Himmelsrichtung und Innen/Außen des gewählten Standorts zur Pflanze passen. Fehlen
              Angaben, steht dort „nicht bewertbar" statt einer Vermutung.
            </p>
          </details>
          <details className="faq-item">
            <summary>Was macht die Wetter-/Frostwarnung?</summary>
            <p>
              Sobald oben ein Standort gesetzt ist, ruft die App nachts die Wettervorhersage ab und
              warnt bei drohendem Frost (mit Liste gefährdeter Außenpflanzen), Hitze und verschiebt
              Gießaufgaben im Freien automatisch bei ausreichend Regen.
            </p>
          </details>
          <details className="faq-item">
            <summary>Was sind Beetpläne?</summary>
            <p>
              Im Tab „Beetpläne": ein Raster in selbst gewählter Größe anlegen und Feld für Feld mit
              Katalog-Pflanzen belegen. „Prüfen" gleicht alle Nachbarfelder gegen die
              Mischkultur-Daten ab und markiert gute (grün) und schlechte (rot) Nachbarschaften.
            </p>
          </details>
          <details className="faq-item">
            <summary>Was zeigt die Übersicht?</summary>
            <p>
              Die Startseite bündelt, was heute wichtig ist: fällige/überfällige Aufgaben, aktive
              Wetterwarnungen, Standort-Probleme und einen Hinweis, was diesen Monat säbar ist.
            </p>
          </details>
          <details className="faq-item">
            <summary>Wie funktioniert die tägliche Zusammenfassung?</summary>
            <p>
              Statt einer Benachrichtigung pro fälliger Aufgabe kommt einmal täglich eine
              gebündelte Zusammenfassung — nur innerhalb des oben eingestellten Zeitfensters.
            </p>
          </details>
        </div>

        <div className="section">
          <button className="btn btn--ghost" onClick={handleLogout}>
            Ausloggen
          </button>
        </div>
      </div>
    </div>
  );
}
