import { useEffect, useState } from "react";
import { enableNotifications, sendTestNotification } from "../push";

interface User {
  username: string;
}

export function SettingsPage({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const [health, setHealth] = useState<"prüfe…" | "ok" | "nicht erreichbar">("prüfe…");
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status === "ok" ? "ok" : "nicht erreichbar"))
      .catch(() => setHealth("nicht erreichbar"));
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

        <div className="section">
          <button className="btn btn--ghost" onClick={handleLogout}>
            Ausloggen
          </button>
        </div>
      </div>
    </div>
  );
}
