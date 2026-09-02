import { useEffect, useState } from "react";
import { enableNotifications, sendTestNotification } from "../push";
import { api, type UserSettings } from "../api";

interface User {
  username: string;
}

export function SettingsPage({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const [health, setHealth] = useState<"prüfe…" | "ok" | "nicht erreichbar">("prüfe…");
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status === "ok" ? "ok" : "nicht erreichbar"))
      .catch(() => setHealth("nicht erreichbar"));
    api.settings.get().then(setSettings);
  }, []);

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
          <button className="btn btn--ghost" onClick={handleLogout}>
            Ausloggen
          </button>
        </div>
      </div>
    </div>
  );
}
