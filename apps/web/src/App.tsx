import { useEffect, useState } from "react";
import { AppBar } from "./components/AppBar";
import { BottomNav, type Tab } from "./components/BottomNav";
import { AuthPage } from "./pages/AuthPage";
import { PlantsPage } from "./pages/PlantsPage";
import { PlantDetailPage } from "./pages/PlantDetailPage";
import { PlantFormPage } from "./pages/PlantFormPage";
import { CatalogPage } from "./pages/CatalogPage";
import { SpeciesDetailPage } from "./pages/SpeciesDetailPage";
import { SettingsPage } from "./pages/SettingsPage";

interface User {
  username: string;
}

type View =
  | { name: "list" }
  | { name: "plant-detail"; id: string }
  | { name: "plant-form"; id: string | null }
  | { name: "species-detail"; id: string };

function titleFor(tab: Tab, view: View): string {
  if (view.name === "plant-form") return view.id ? "Pflanze bearbeiten" : "Neue Pflanze";
  if (view.name === "plant-detail") return "Pflanze";
  if (view.name === "species-detail") return "Katalog";
  if (tab === "plants") return "Meine Pflanzen";
  if (tab === "catalog") return "Katalog";
  return "Einstellungen";
}

function AppShell({ user, onLoggedOut }: { user: User; onLoggedOut: () => void }) {
  const [tab, setTab] = useState<Tab>("plants");
  const [view, setView] = useState<View>({ name: "list" });

  function handleTabChange(next: Tab) {
    setTab(next);
    setView({ name: "list" });
  }

  function handleBack() {
    if (view.name === "plant-form" && view.id) {
      setView({ name: "plant-detail", id: view.id });
    } else {
      setView({ name: "list" });
    }
  }

  return (
    <div className="app-shell">
      <AppBar title={titleFor(tab, view)} onBack={view.name !== "list" ? handleBack : undefined} />

      {tab === "plants" && view.name === "list" && (
        <PlantsPage onOpenPlant={(id) => setView({ name: "plant-detail", id })} />
      )}
      {tab === "plants" && view.name === "plant-detail" && (
        <PlantDetailPage
          id={view.id}
          onEdit={() => setView({ name: "plant-form", id: view.id })}
          onDeleted={() => setView({ name: "list" })}
        />
      )}
      {tab === "plants" && view.name === "plant-form" && (
        <PlantFormPage
          plantId={view.id}
          onSaved={(id) => setView({ name: "plant-detail", id })}
          onCancel={() => setView(view.id ? { name: "plant-detail", id: view.id } : { name: "list" })}
        />
      )}

      {tab === "catalog" && view.name === "list" && (
        <CatalogPage onOpenSpecies={(id) => setView({ name: "species-detail", id })} />
      )}
      {tab === "catalog" && view.name === "species-detail" && (
        <SpeciesDetailPage
          id={view.id}
          onAddedToMyPlants={(plantId) => {
            setTab("plants");
            setView({ name: "plant-detail", id: plantId });
          }}
        />
      )}

      {tab === "settings" && <SettingsPage user={user} onLoggedOut={onLoggedOut} />}

      {view.name === "list" && tab === "plants" && (
        <button
          className="fab"
          aria-label="Neue Pflanze"
          onClick={() => setView({ name: "plant-form", id: null })}
        >
          +
        </button>
      )}

      <BottomNav active={tab} onChange={handleTabChange} />
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
  if (user === null) return <AuthPage onAuthenticated={setUser} />;
  return <AppShell user={user} onLoggedOut={() => setUser(null)} />;
}
