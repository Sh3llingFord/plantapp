export function AppBar({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <header className="app-bar">
      {onBack && (
        <button type="button" className="app-bar__back" onClick={onBack} aria-label="Zurück">
          ←
        </button>
      )}
      <h1 className="app-bar__title">{title}</h1>
    </header>
  );
}
