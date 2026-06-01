import { describe, expect, it } from "vitest";
import { calculatePoints, createUniqueNickname, normalizeRoomCode, rankPlayers, sanitizeQuiz } from "./game";

describe("game helpers", () => {
  it("normalizes room codes", () => {
    expect(normalizeRoomCode(" ab-12 cd ")).toBe("AB12CD");
  });

  it("adds suffixes for duplicate nicknames", () => {
    expect(createUniqueNickname("Ava", [{ id: "1", nickname: "Ava", score: 0, joinedAt: 1, connected: true }])).toBe("Ava 2");
  });

  it("awards more points for faster correct answers", () => {
    const question = { id: "q1", prompt: "Q", choices: ["A", "B"], correctIndex: 0, timeLimit: 20 };
    expect(calculatePoints(question, { selectedIndex: 0, submittedAt: 1_000 }, 0)).toBeGreaterThan(
      calculatePoints(question, { selectedIndex: 0, submittedAt: 15_000 }, 0),
    );
    expect(calculatePoints(question, { selectedIndex: 1, submittedAt: 1_000 }, 0)).toBe(0);
  });

  it("filters incomplete quiz questions", () => {
    const quiz = sanitizeQuiz("  Demo  ", [
      { prompt: "Question?", choices: ["Yes", "No", ""], correctIndex: 0, timeLimit: 25 },
      { prompt: "", choices: ["A", "B"], correctIndex: 0, timeLimit: 20 },
    ]);
    expect(quiz.title).toBe("Demo");
    expect(quiz.questions).toHaveLength(1);
  });

  it("ranks players by score then join time", () => {
    const ranked = rankPlayers([
      { id: "2", nickname: "Bee", score: 100, joinedAt: 2, connected: true },
      { id: "1", nickname: "Ace", score: 100, joinedAt: 1, connected: true },
    ]);
    expect(ranked[0].nickname).toBe("Ace");
  });
});
