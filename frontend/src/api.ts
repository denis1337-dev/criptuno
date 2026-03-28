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
import { getTelegramInitData, isTelegramWebApp } from "./telegram";

const isDev = !import.meta.env.PROD;
const API_URL = isDev ? "" : "https://criptuno.onrender.com";
const TOKEN_KEY = "authToken";

const getStoredToken = (): string => {
  return localStorage.getItem(TOKEN_KEY) ?? "";
};

const setStoredToken = (token: string): void => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

let authToken = getStoredToken();

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
    if (response.status === 401) {
      authToken = "";
      setStoredToken("");
    }
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const authWithTelegram = async (): Promise<boolean> => {
  const initData = getTelegramInitData();
  
  if (!initData) {
    authToken = getStoredToken();
    return !!authToken;
  }
  
  try {
    const data = await request<{ token: string }>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData })
    });
    authToken = data.token;
    setStoredToken(data.token);
    return true;
  } catch (e) {
    console.error("Auth error:", e);
    authToken = getStoredToken();
    return !!authToken;
  }
};

export const isAuthorized = (): boolean => {
  return !!authToken || isTelegramWebApp();
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
