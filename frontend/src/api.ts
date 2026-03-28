import {
  Course,
  CourseModule,
  Game,
  Profile,
  PuzzleCollected,
  PuzzleLevel,
  QuizQuestion,
  QuizTest
} from "./types";
import { getTelegramInitData } from "./telegram";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
let authToken = "";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const authWithTelegram = async (): Promise<void> => {
  const initData = getTelegramInitData();
  if (!initData) {
    authToken = "";
    return;
  }
  const data = await request<{ token: string }>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData })
  });
  authToken = data.token;
};

export const getCourses = () => request<Course[]>("/courses");
export const getCourseModules = (courseId: number) => request<CourseModule[]>(`/courses/${courseId}/modules`);
export const getGames = () => request<Game[]>("/games");
export const getPuzzleLevels = () => request<PuzzleLevel[]>("/puzzle-levels");
export const getCollectedPuzzles = (sessionKey: string) =>
  request<PuzzleCollected[]>(`/puzzle-collected?sessionKey=${encodeURIComponent(sessionKey)}`);
export const completePuzzleLevel = (levelId: number, sessionKey: string) =>
  request<{ ok: boolean }>(`/puzzle-levels/${levelId}/complete`, {
    method: "POST",
    body: JSON.stringify({ sessionKey })
  });
export const getQuizTests = () => request<QuizTest[]>("/quiz-tests");
export const getQuizQuestions = (testId: number) =>
  request<QuizQuestion[]>(`/quiz-tests/${testId}/questions`);
export const getProfile = () => request<Profile>("/profile/me");
export const submitGameResult = (gameId: number, score: number) =>
  request<{ ok: boolean }>(`/games/${gameId}/results`, {
    method: "POST",
    body: JSON.stringify({ score, idempotencyKey: crypto.randomUUID() })
  });
