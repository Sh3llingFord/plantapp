import { useEffect, useState } from "react";
import { enableNotifications, sendTestNotification } from "./push";

interface User {
  username: string;
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand__leaf" aria-hidden="true">
        🌱
      </span>
      <span className="brand__title">Plants vs. Mella</span>
    </div>
  );
}

function AuthForm({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login" ? { username, password } : { username, password, setupCode };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehlgeschlagen");
      }
      onAuthenticated(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <Brand />
      <div className="card">
        <div className="tabs">
          <button type="button" disabled={mode === "login"} onClick={() => setMode("login")}>
            Einloggen
          </button>
          <button
            type="button"
            disabled={mode === "register"}
            onClick={() => setMode("register")}
          >
            Konto erstellen
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Benutzername</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {mode === "register" && (
            <div className="field">
              <label htmlFor="setupCode">Setup-Code</label>
              <input
                id="setupCode"
                type="text"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                required
              />
            </div>
          )}
          {error && <p className="alert alert--error">{error}</p>}
          <button className="btn btn--primary" type="submit" disabled={loading}>
            {loading ? "…" : mode === "login" ? "Einloggen" : "Konto erstellen"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Settings({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
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
    <div className="page">
      <Brand />
      <div className="card">
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

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return null;
  if (user === null) return <AuthForm onAuthenticated={setUser} />;
  return <Settings user={user} onLoggedOut={() => setUser(null)} />;
}
