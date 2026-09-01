import { useEffect, useState } from "react";

export function App() {
  const [health, setHealth] = useState<string>("prüfe...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth("nicht erreichbar"));
  }, []);

  return (
    <main>
      <h1>plantapp</h1>
      <p>API-Status: {health}</p>
    </main>
  );
}
