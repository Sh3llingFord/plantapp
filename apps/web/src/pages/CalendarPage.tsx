import { useEffect, useMemo, useState } from "react";
import { api, TASK_LABELS, type Task, type TaskType } from "../api";

const ALL_TYPES: TaskType[] = [
  "water",
  "fertilize",
  "prune",
  "repot",
  "harvest",
  "winter_protect_in",
  "winter_protect_out",
];

const LAYER_STORAGE_KEY = "plantapp:calendar-layers";

function loadActiveLayers(): Set<TaskType> {
  try {
    const raw = localStorage.getItem(LAYER_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set(ALL_TYPES);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateHeading(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays < 0) return `${date.toLocaleDateString("de-DE")} (überfällig)`;
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}

export function CalendarPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<TaskType>>(loadActiveLayers);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);

  function load() {
    const from = new Date();
    from.setDate(from.getDate() - 14); // überfällige der letzten 2 Wochen mit anzeigen
    const to = new Date();
    to.setDate(to.getDate() + 60);
    api.tasks
      .list({ from: from.toISOString(), to: to.toISOString() })
      .then(setTasks)
      .catch(() => setTasks([]));
  }

  useEffect(load, []);

  useEffect(() => {
    localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify([...activeLayers]));
  }, [activeLayers]);

  useEffect(() => {
    api.calendar.token().then(({ token }) => {
      setIcsUrl(`${window.location.origin}/api/calendar/feed.ics?token=${token}`);
    });
  }, []);

  function toggleLayer(type: TaskType) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleAction(taskId: string, status: "done" | "skipped" | "later") {
    await api.tasks.update(taskId, status);
    load();
  }

  const grouped = useMemo(() => {
    if (!tasks) return [];
    const filtered = tasks
      .filter((t) => activeLayers.has(t.type))
      .filter((t) => t.status === "pending" || t.dueDate.slice(0, 10) === todayStr());
    const byDate = new Map<string, Task[]>();
    for (const t of filtered) {
      const day = t.dueDate.slice(0, 10);
      if (!byDate.has(day)) byDate.set(day, []);
      byDate.get(day)!.push(t);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, activeLayers]);

  return (
    <div className="app-content">
      <div className="chip-row">
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`chip ${activeLayers.has(type) ? "chip--active" : ""}`}
            onClick={() => toggleLayer(type)}
          >
            {TASK_LABELS[type]}
          </button>
        ))}
      </div>

      {tasks === null && <p>lädt…</p>}

      {tasks && grouped.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            📅
          </span>
          <p>Keine anstehenden Aufgaben in den nächsten Wochen.</p>
        </div>
      )}

      {grouped.map(([day, dayTasks]) => (
        <div key={day} className="detail-card">
          <p className="section__title">{formatDateHeading(day)}</p>
          <div className="list">
            {dayTasks.map((task) => (
              <div key={task.id} className="list-item" style={{ cursor: "default" }}>
                {task.plantPhotoPath ? (
                  <img className="list-item__thumb" src={task.plantPhotoPath} alt="" />
                ) : (
                  <span className="list-item__thumb" aria-hidden="true">🪴</span>
                )}
                <div className="list-item__body">
                  <div className="list-item__title">{task.plantNickname}</div>
                  <div className="list-item__subtitle">{TASK_LABELS[task.type]}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn btn--primary"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                    onClick={() => handleAction(task.id, "done")}
                    title="Erledigt"
                  >
                    ✓
                  </button>
                  <button
                    className="btn btn--secondary"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                    onClick={() => handleAction(task.id, "later")}
                    title="Später"
                  >
                    ⏰
                  </button>
                  <button
                    className="btn btn--ghost"
                    style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                    onClick={() => handleAction(task.id, "skipped")}
                    title="Übersprungen"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {icsUrl && (
        <div className="detail-card">
          <p className="section__title">
            <span aria-hidden="true">🔗</span> Kalender abonnieren
          </p>
          <p style={{ fontSize: 12, wordBreak: "break-all", color: "var(--color-text-muted)" }}>
            {icsUrl}
          </p>
          <button
            className="btn btn--secondary"
            onClick={() => navigator.clipboard.writeText(icsUrl)}
          >
            Link kopieren
          </button>
        </div>
      )}
    </div>
  );
}
