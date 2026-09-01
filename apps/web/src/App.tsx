import { useEffect, useState } from "react";
import { enableNotifications, sendTestNotification } from "./push";

interface User {
  username: string;
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
    <main>
      <h1>Plants vs. Mella</h1>
      <nav>
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
      </nav>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Benutzername
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Passwort
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        </div>
        {mode === "register" && (
          <div>
            <label>
              Setup-Code
              <input
                type="text"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                required
              />
            </label>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "…" : mode === "login" ? "Einloggen" : "Konto erstellen"}
        </button>
      </form>
    </main>
  );
}

function Settings({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const [health, setHealth] = useState("prüfe...");
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
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
    <main>
      <h1>Plants vs. Mella</h1>
      <p>Eingeloggt als {user.username}</p>
      <p>API-Status: {health}</p>
      <section>
        <h2>Benachrichtigungen</h2>
        <button onClick={handleEnableNotifications}>Benachrichtigungen aktivieren</button>
        <button onClick={handleTestNotification}>Testbenachrichtigung senden</button>
        {pushStatus && <p>{pushStatus}</p>}
      </section>
      <button onClick={handleLogout}>Ausloggen</button>
    </main>
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
