import type { Answer, Player, QuizDraftQuestion, QuizQuestion } from "./types";

export const MAX_PLAYERS = 30;
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: ROOM_CODE_LENGTH }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

export function normalizeNickname(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function createUniqueNickname(nickname: string, players: Player[]): string {
  const base = normalizeNickname(nickname) || "Player";
  const existing = new Set(players.map((player) => player.nickname.toLowerCase()));
  if (!existing.has(base.toLowerCase())) {
    return base;
  }

  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${base} ${Date.now().toString().slice(-4)}`;
}

export function calculatePoints(question: QuizQuestion, answer: Pick<Answer, "selectedIndex" | "submittedAt">, startedAt: number): number {
  if (answer.selectedIndex !== question.correctIndex) {
    return 0;
  }

  const elapsed = Math.max(0, answer.submittedAt - startedAt);
  const limit = question.timeLimit * 1000;
  const remainingRatio = Math.max(0, 1 - elapsed / limit);
  return 500 + Math.round(500 * remainingRatio);
}

export function sanitizeQuiz(title: string, drafts: QuizDraftQuestion[]): { title: string; questions: QuizQuestion[] } {
  const cleanTitle = title.trim().slice(0, 80) || "Untitled Quiz";
  const questions = drafts
    .map((draft, index) => {
      const choices = draft.choices.map((choice) => choice.trim()).filter(Boolean).slice(0, 4);
      return {
        id: `q${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
        prompt: draft.prompt.trim().slice(0, 220),
        choices,
        correctIndex: Math.min(Math.max(0, draft.correctIndex), Math.max(0, choices.length - 1)),
        timeLimit: Math.min(90, Math.max(10, Number(draft.timeLimit) || 20)),
      };
    })
    .filter((question) => question.prompt.length > 0 && question.choices.length >= 2);

  return { title: cleanTitle, questions };
}

export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
}
