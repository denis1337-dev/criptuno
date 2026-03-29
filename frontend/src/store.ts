import { create } from "zustand";
import { Course, Game, Profile } from "./types";
import { authWithTelegram, getCourses, getGames, getProfile, submitGameResult } from "./api";

type Tab = "courses" | "games" | "meditation" | "profile";

type AppState = {
  activeTab: Tab;
  courses: Course[];
  games: Game[];
  profile: Profile | null;
  loading: boolean;
  setTab: (tab: Tab) => void;
  bootstrap: () => Promise<void>;
  playGame: (gameId: number, score: number) => Promise<void>;
};

export const useAppStore = create<AppState>((set) => ({
  activeTab: "courses",
  courses: [],
  games: [],
  profile: null,
  loading: false,
  setTab: (tab) => set({ activeTab: tab }),
  bootstrap: async () => {
    set({ loading: true });
    try {
      await authWithTelegram();
      const [courses, games] = await Promise.all([getCourses(), getGames()]);
      set({ courses, games });
      try {
        const profile = await getProfile();
        set({ profile });
      } catch {
        set({ profile: null });
      }
    } finally {
      set({ loading: false });
    }
  },
  playGame: async (gameId, score) => {
    try {
      await submitGameResult(gameId, score);
      const profile = await getProfile();
      set({ profile });
    } catch {
      // Local preview mode without Telegram auth should keep games usable.
    }
  }
}));
