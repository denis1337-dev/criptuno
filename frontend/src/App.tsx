import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "./store";
import { GamesPage } from "./pages/GamesPage";
import { MeditationPage } from "./pages/MeditationPage";
import { ProfilePage } from "./pages/ProfilePage";

export const App = () => {
  const { t } = useTranslation();
  const activeTab = useAppStore((s) => s.activeTab);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const loading = useAppStore((s) => s.loading);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <main className="app">
      {loading ? <p>{t('app.loading')}</p> : null}
      {activeTab === "games" ? <GamesPage /> : null}
      {activeTab === "meditation" ? <MeditationPage /> : null}
      {activeTab === "profile" ? <ProfilePage /> : null}
      <BottomNav />
    </main>
  );
};

const BottomNav = () => {
  const { t } = useTranslation();
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  return (
    <nav className="bottom-nav">
      <button className={activeTab === "games" ? "active" : ""} onClick={() => setTab("games")}>
        <span className="nav-icon">🎮</span>
        <span>{t('nav.games')}</span>
      </button>
      <button className={activeTab === "meditation" ? "active" : ""} onClick={() => setTab("meditation")}>
        <span className="nav-icon">🧘</span>
        <span>{t('nav.meditation')}</span>
      </button>
      <button className={activeTab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
        <span className="nav-icon">👤</span>
        <span>{t('nav.profile')}</span>
      </button>
    </nav>
  );
};
