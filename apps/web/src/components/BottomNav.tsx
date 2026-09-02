export type Tab = "plants" | "calendar" | "catalog" | "settings";

const items: { tab: Tab; icon: string; label: string }[] = [
  { tab: "plants", icon: "🪴", label: "Meine Pflanzen" },
  { tab: "calendar", icon: "📅", label: "Kalender" },
  { tab: "catalog", icon: "📖", label: "Katalog" },
  { tab: "settings", icon: "⚙️", label: "Einstellungen" },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.tab}
          type="button"
          className={`bottom-nav__item ${active === item.tab ? "bottom-nav__item--active" : ""}`}
          onClick={() => onChange(item.tab)}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
