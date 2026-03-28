export type Course = {
  id: number;
  title: string;
  orderIndex: number;
  url: string;
  isPremium: boolean;
};

export type CourseModule = {
  id: number;
  title: string;
  content: string;
  orderIndex: number;
};

export type Game = {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
};

export type Profile = {
  telegramId: number;
  username: string | null;
  firstName: string;
  avatarStage: "stage1" | "stage2" | "stage3";
  totalScore: number;
  completedGames: number;
};

export type QuizTest = {
  id: number;
  title: string;
  courseId: number | null;
  orderIndex: number;
};

export type QuizQuestion = {
  id: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  orderIndex: number;
};

export type PuzzleLevel = {
  id: number;
  title: string;
  imageUrl: string;
  orderIndex: number;
};

export type PuzzleCollected = {
  levelId: number;
  levelTitle: string;
  imageUrl: string;
  completedAt: string;
};
