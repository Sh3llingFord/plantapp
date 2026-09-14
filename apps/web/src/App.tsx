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
import { CalendarPage } from "./pages/CalendarPage";
import { GardenPlansPage } from "./pages/GardenPlansPage";
import { GardenPlanEditorPage } from "./pages/GardenPlanEditorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { WelcomeModal } from "./components/WelcomeModal";

interface User {
  username: string;
}

type View =
  | { name: "list" }
  | { name: "plant-detail"; id: string }
  | { name: "plant-form"; id: string | null }
  | { name: "species-detail"; id: string }
  | { name: "garden-plan-editor"; id: string };

interface NavState {
  tab: Tab;
  view: View;
}

const INITIAL_STATE: NavState = { tab: "home", view: { name: "list" } };

function titleFor(tab: Tab, view: View): string {
  if (view.name === "plant-form") return view.id ? "Pflanze bearbeiten" : "Neue Pflanze";
  if (view.name === "plant-detail") return "Pflanze";
  if (view.name === "species-detail") return "Katalog";
  if (view.name === "garden-plan-editor") return "Beetplan";
  if (tab === "plants") return "Meine Pflanzen";
  if (tab === "calendar") return "Kalender";
  if (tab === "catalog") return "Katalog";
  if (tab === "garden") return "Meine Beetpläne";
  if (tab === "home") return "Übersicht";
  return "Einstellungen";
}

function AppShell({
  user,
  onLoggedOut,
  showWelcome,
  onCloseWelcome,
}: {
  user: User;
  onLoggedOut: () => void;
  showWelcome: boolean;
  onCloseWelcome: () => void;
}) {
  const [tab, setTab] = useState<Tab>(INITIAL_STATE.tab);
  const [view, setView] = useState<View>(INITIAL_STATE.view);

  // Android/PWA: ohne History-API-Anbindung landet der Hardware-/Gesten-Zurück-Button
  // sofort außerhalb der App, statt nur einen Schritt in der eigenen Navigation
  // zurückzugehen — jede Drilldown-Navigation bekommt deshalb einen echten
  // Verlaufseintrag, "zurück" ruft nur noch window.history.back() auf.
  useEffect(() => {
    window.history.replaceState(INITIAL_STATE, "");

    function handlePopState(event: PopStateEvent) {
      const state = (event.state as NavState | null) ?? INITIAL_STATE;
      setTab(state.tab);
      setView(state.view);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  /** Neuer Bildschirm, der auf den Verlaufs-Stack gelegt wird ("vorwärts"). */
  function navigate(nextTab: Tab, nextView: View) {
    window.history.pushState({ tab: nextTab, view: nextView } satisfies NavState, "");
    setTab(nextTab);
    setView(nextView);
  }

  /** Abschluss eines Formulars/einer Aktion — ersetzt den aktuellen Eintrag,
   * statt den Verlauf um einen nicht mehr sinnvoll anspringbaren Schritt
   * (z.B. ein bereits abgeschicktes Formular) zu verlängern. */
  function replaceNav(nextTab: Tab, nextView: View) {
    window.history.replaceState({ tab: nextTab, view: nextView } satisfies NavState, "");
    setTab(nextTab);
    setView(nextView);
  }

  function handleTabChange(next: Tab) {
    navigate(next, { name: "list" });
  }

  function handleBack() {
    window.history.back();
  }

  return (
    <div className="app-shell">
      <AppBar title={titleFor(tab, view)} onBack={view.name !== "list" ? handleBack : undefined} />

      {tab === "home" && <DashboardPage />}

      {tab === "plants" && view.name === "list" && (
        <PlantsPage onOpenPlant={(id) => navigate("plants", { name: "plant-detail", id })} />
      )}
      {tab === "plants" && view.name === "plant-detail" && (
        <PlantDetailPage
          id={view.id}
          onEdit={() => navigate("plants", { name: "plant-form", id: view.id })}
          onDeleted={() => replaceNav("plants", { name: "list" })}
        />
      )}
      {tab === "plants" && view.name === "plant-form" && (
        <PlantFormPage
          plantId={view.id}
          onSaved={(id) => replaceNav("plants", { name: "plant-detail", id })}
          onCancel={() => replaceNav("plants", view.id ? { name: "plant-detail", id: view.id } : { name: "list" })}
        />
      )}

      {tab === "catalog" && view.name === "list" && (
        <CatalogPage onOpenSpecies={(id) => navigate("catalog", { name: "species-detail", id })} />
      )}
      {tab === "catalog" && view.name === "species-detail" && (
        <SpeciesDetailPage
          id={view.id}
          onAddedToMyPlants={(plantId) => navigate("plants", { name: "plant-detail", id: plantId })}
        />
      )}

      {tab === "garden" && view.name === "list" && (
        <GardenPlansPage onOpenPlan={(id) => navigate("garden", { name: "garden-plan-editor", id })} />
      )}
      {tab === "garden" && view.name === "garden-plan-editor" && (
        <GardenPlanEditorPage id={view.id} onDeleted={() => replaceNav("garden", { name: "list" })} />
      )}

      {tab === "calendar" && <CalendarPage />}

      {tab === "settings" && <SettingsPage user={user} onLoggedOut={onLoggedOut} />}

      {view.name === "list" && tab === "plants" && (
        <button
          className="fab"
          aria-label="Neue Pflanze"
          onClick={() => navigate("plants", { name: "plant-form", id: null })}
        >
          +
        </button>
      )}

      <BottomNav active={tab} onChange={handleTabChange} />

      {showWelcome && <WelcomeModal onClose={onCloseWelcome} />}
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return null;
  if (user === null) {
    return (
      <AuthPage
        onAuthenticated={(u, isNewAccount) => {
          setUser(u);
          if (isNewAccount) setShowWelcome(true);
        }}
      />
    );
  }
  return (
    <AppShell
      user={user}
      onLoggedOut={() => setUser(null)}
      showWelcome={showWelcome}
      onCloseWelcome={() => setShowWelcome(false)}
    />
  );
}
