const FEATURES = [
  {
    icon: "🪴",
    title: "Pflanzen anlegen",
    text: "Katalog durchsuchen oder einfach einen Namen eintragen — das Pflegeprofil wird dann automatisch recherchiert.",
  },
  {
    icon: "🗺️",
    title: "Beetpläne",
    text: "Eigenes Raster anlegen, mit Pflanzen belegen und prüfen, welche Kombinationen sich vertragen.",
  },
  {
    icon: "📅",
    title: "Kalender & Aufgaben",
    text: "Gieß-, Dünge- und Pflegetermine entstehen automatisch. In den Einstellungen lassen sich Ruhezeiten und die tägliche Zusammenfassung anpassen.",
  },
  {
    icon: "🔔",
    title: "Benachrichtigungen",
    text: "In den Einstellungen aktivieren, damit fällige Aufgaben und Wetterwarnungen nicht untergehen.",
  },
];

export function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <p className="section__title" style={{ fontSize: 18 }}>
          <span aria-hidden="true">🌱</span> Willkommen bei Plants vs. Mella!
        </p>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 14 }}>
          Ganz kurz, was hier geht:
        </p>

        <div className="list">
          {FEATURES.map((f) => (
            <div key={f.title} className="list-item" style={{ cursor: "default" }}>
              <span className="list-item__thumb" aria-hidden="true">
                {f.icon}
              </span>
              <div className="list-item__body">
                <div className="list-item__title">{f.title}</div>
                <div className="list-item__subtitle" style={{ whiteSpace: "normal" }}>
                  {f.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={onClose}>
          Los geht's
        </button>
      </div>
    </div>
  );
}
