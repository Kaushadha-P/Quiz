export type RoomStatus = "lobby" | "active" | "finished";
export type RoomPhase = "lobby" | "question" | "reveal" | "leaderboard" | "finished";

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  timeLimit: number;
}

export interface QuizDraftQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  timeLimit: number;
}

export interface Room {
  code: string;
  hostId: string;
  title: string;
  status: RoomStatus;
  phase: RoomPhase;
  createdAt: number;
  maxPlayers: number;
  currentQuestionIndex: number;
  questionStartedAt?: number;
  questions: QuizQuestion[];
  players?: Record<string, Player>;
  answers?: Record<string, Record<string, Answer>>;
}

export interface Player {
  id: string;
  nickname: string;
  score: number;
  joinedAt: number;
  connected: boolean;
  lastAnswerQuestionId?: string;
}

export interface Answer {
  playerId: string;
  questionId: string;
  selectedIndex: number;
  submittedAt: number;
  isCorrect?: boolean;
  points?: number;
}

export interface FirebaseConfigStatus {
  ready: boolean;
  missingKeys: string[];
}
