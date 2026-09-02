import { useState } from "react";

interface User {
  username: string;
}

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
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
      <div className="brand">
        <span className="brand__leaf" aria-hidden="true">🌱</span>
        <span className="brand__title">Plants vs. Mella</span>
      </div>
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
