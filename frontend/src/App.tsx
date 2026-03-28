import { useEffect } from "react";
import { useAppStore } from "./store";
import { CoursesPage } from "./pages/CoursesPage";
import { GamesPage } from "./pages/GamesPage";
import { MeditationPage } from "./pages/MeditationPage";
import { ProfilePage } from "./pages/ProfilePage";

export const App = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const loading = useAppStore((s) => s.loading);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <main className="app">
      {loading ? <p>Загрузка...</p> : null}
      {activeTab === "courses" ? <CoursesPage /> : null}
      {activeTab === "games" ? <GamesPage /> : null}
      {activeTab === "meditation" ? <MeditationPage /> : null}
      {activeTab === "profile" ? <ProfilePage /> : null}
      <BottomNav />
    </main>
  );
};

const BottomNav = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  return (
    <nav className="bottom-nav">
      <button className={activeTab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>
        <span className="nav-icon">📚</span>
        <span>Курсы</span>
      </button>
      <button className={activeTab === "games" ? "active" : ""} onClick={() => setTab("games")}>
        <span className="nav-icon">🎮</span>
        <span>Игры</span>
      </button>
      <button className={activeTab === "meditation" ? "active" : ""} onClick={() => setTab("meditation")}>
        <span className="nav-icon">🧘</span>
        <span>Антистресс</span>
      </button>
      <button className={activeTab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
        <span className="nav-icon">👤</span>
        <span>Профиль</span>
      </button>
    </nav>
  );
};
