import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Crown, Play, Plus, Sparkles, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createRoom,
  deleteRoom,
  endRoom,
  firebaseConfigStatus,
  getCurrentUserId,
  joinRoom,
  nextQuestion,
  revealQuestion,
  startGame,
  submitAnswer,
  subscribeRoom,
} from "./firebase";
import { MAX_PLAYERS, normalizeRoomCode, rankPlayers, sanitizeQuiz } from "./game";
import type { Player, QuizDraftQuestion, Room } from "./types";

type Screen = "home" | "host-builder" | "host-room" | "player-room";

const emptyQuestion = (): QuizDraftQuestion => ({
  prompt: "",
  choices: ["", "", "", ""],
  correctIndex: 0,
  timeLimit: 20,
});

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [roomCode, setRoomCode] = useState("");

  return (
    <main className="app-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <AnimatePresence mode="wait">
        {screen === "home" && (
          <HomeScreen
            key="home"
            onHost={() => setScreen("host-builder")}
            onJoined={(code) => {
              setRoomCode(code);
              setScreen("player-room");
            }}
          />
        )}
        {screen === "host-builder" && (
          <HostBuilder
            key="host-builder"
            onBack={() => setScreen("home")}
            onCreated={(code) => {
              setRoomCode(code);
              setScreen("host-room");
            }}
          />
        )}
        {screen === "host-room" && <RoomConsole key="host-room" code={roomCode} mode="host" onExit={() => setScreen("home")} />}
        {screen === "player-room" && <RoomConsole key="player-room" code={roomCode} mode="player" onExit={() => setScreen("home")} />}
      </AnimatePresence>
    </main>
  );
}

function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section className={`page ${className}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
      {children}
    </motion.section>
  );
}

function HomeScreen({ onHost, onJoined }: { onHost: () => void; onJoined: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const cleanCode = normalizeRoomCode(code);
    if (!cleanCode || !nickname.trim()) {
      setError("Enter a room code and nickname.");
      return;
    }

    try {
      setJoining(true);
      await joinRoom(cleanCode, nickname);
      onJoined(cleanCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this room.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <Page className="home-grid">
      <section className="hero-panel">
        <p className="eyebrow">
          <Sparkles size={18} /> Real-time quiz battles
        </p>
        <h1>Quiz Spark</h1>
        <p className="hero-copy">Create a room, let up to 30 players join, launch live questions, and finish with a bright leaderboard.</p>
        {!firebaseConfigStatus.ready && (
          <div className="setup-warning">
            Firebase config is missing. Add `.env.local` values from `.env.example` before running live rooms.
          </div>
        )}
        <button className="primary-action" type="button" onClick={onHost}>
          <Play size={20} /> Host a game
        </button>
      </section>

      <form className="join-panel" onSubmit={handleJoin}>
        <h2>Join game</h2>
        <label>
          Room code
          <input value={code} onChange={(event) => setCode(normalizeRoomCode(event.target.value))} placeholder="ABC123" />
        </label>
        <label>
          Nickname
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Your name" maxLength={24} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="secondary-action" disabled={joining || !firebaseConfigStatus.ready} type="submit">
          {joining ? "Joining..." : "Enter lobby"}
        </button>
      </form>
    </Page>
  );
}

function HostBuilder({ onBack, onCreated }: { onBack: () => void; onCreated: (code: string) => void }) {
  const [title, setTitle] = useState("Friday Brain Blast");
  const [questions, setQuestions] = useState<QuizDraftQuestion[]>([
    { prompt: "Which planet is known as the Red Planet?", choices: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1, timeLimit: 20 },
  ]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  function updateQuestion(index: number, next: QuizDraftQuestion) {
    setQuestions((current) => current.map((question, questionIndex) => (questionIndex === index ? next : question)));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const quiz = sanitizeQuiz(title, questions);
    if (quiz.questions.length === 0) {
      setError("Add at least one complete question with two answer choices.");
      return;
    }

    try {
      setCreating(true);
      setError("");
      const code = await createRoom(quiz.title, quiz.questions);
      onCreated(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Page>
      <form className="builder" onSubmit={handleCreate}>
        <div className="builder-header">
          <div>
            <p className="eyebrow">Host console</p>
            <h1>Build your quiz</h1>
          </div>
          <button className="ghost-action" type="button" onClick={onBack}>
            Back
          </button>
        </div>

        <label>
          Quiz title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} />
        </label>

        <div className="question-stack">
          {questions.map((question, index) => (
            <motion.section className="question-editor" key={index} layout>
              <div className="question-editor-top">
                <h2>Question {index + 1}</h2>
                {questions.length > 1 && (
                  <button className="icon-button" type="button" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))} aria-label="Remove question">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <label>
                Prompt
                <textarea value={question.prompt} onChange={(event) => updateQuestion(index, { ...question, prompt: event.target.value })} maxLength={220} />
              </label>
              <div className="choice-grid">
                {question.choices.map((choice, choiceIndex) => (
                  <label className={question.correctIndex === choiceIndex ? "choice-field correct" : "choice-field"} key={choiceIndex}>
                    <span>Choice {choiceIndex + 1}</span>
                    <input
                      value={choice}
                      onChange={(event) => {
                        const choices = [...question.choices];
                        choices[choiceIndex] = event.target.value;
                        updateQuestion(index, { ...question, choices });
                      }}
                    />
                    <button type="button" onClick={() => updateQuestion(index, { ...question, correctIndex: choiceIndex })}>
                      {question.correctIndex === choiceIndex ? <Check size={16} /> : "Mark correct"}
                    </button>
                  </label>
                ))}
              </div>
              <label className="timer-field">
                Seconds
                <input
                  type="number"
                  min={10}
                  max={90}
                  value={question.timeLimit}
                  onChange={(event) => updateQuestion(index, { ...question, timeLimit: Number(event.target.value) })}
                />
              </label>
            </motion.section>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="builder-actions">
          <button className="secondary-action" type="button" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}>
            <Plus size={18} /> Add question
          </button>
          <button className="primary-action" disabled={creating || !firebaseConfigStatus.ready} type="submit">
            {creating ? "Creating..." : "Create lobby"}
          </button>
        </div>
      </form>
    </Page>
  );
}

function RoomConsole({ code, mode, onExit }: { code: string; mode: "host" | "player"; onExit: () => void }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeRoom(code, (nextRoom) => {
      setRoom(nextRoom);
      setNotFound(!nextRoom);
    });
    return unsubscribe;
  }, [code]);

  if (notFound) {
    return (
      <Page>
        <div className="empty-state">
          <h1>Room closed</h1>
          <button className="primary-action" onClick={onExit} type="button">
            Return home
          </button>
        </div>
      </Page>
    );
  }

  if (!room) {
    return (
      <Page>
        <div className="empty-state">
          <div className="loader" />
          <p>Connecting to room {code}...</p>
        </div>
      </Page>
    );
  }

  return mode === "host" ? <HostRoom room={room} onExit={onExit} /> : <PlayerRoom room={room} onExit={onExit} />;
}

function HostRoom({ room, onExit }: { room: Room; onExit: () => void }) {
  const players = useMemo(() => rankPlayers(Object.values((room.players ?? {}) as Record<string, Player>)), [room.players]);
  const question = room.questions[room.currentQuestionIndex];

  async function handleEnd() {
    await endRoom(room.code);
  }

  return (
    <Page>
      <section className="room-shell">
        <RoomHeader room={room} onExit={onExit} />

        {room.phase === "lobby" && (
          <div className="lobby-layout">
            <div className="code-card">
              <p>Join code</p>
              <strong>{room.code}</strong>
              <button className="secondary-action" type="button" onClick={() => navigator.clipboard?.writeText(room.code)}>
                <Copy size={18} /> Copy
              </button>
            </div>
            <LobbyList players={players} />
            <button className="primary-action wide" disabled={players.length === 0} type="button" onClick={() => startGame(room.code)}>
              <Play size={20} /> Start game
            </button>
          </div>
        )}

        {room.phase === "question" && question && (
          <HostQuestion room={room} players={players} onReveal={() => revealQuestion(room.code, room)} onEnd={handleEnd} />
        )}

        {room.phase === "reveal" && question && (
          <RevealPanel room={room} players={players} onNext={() => nextQuestion(room.code, room)} onEnd={handleEnd} />
        )}

        {room.phase === "finished" && <FinalLeaderboard players={players} hostActions onDelete={() => deleteRoom(room.code).then(onExit)} />}
      </section>
    </Page>
  );
}

function PlayerRoom({ room, onExit }: { room: Room; onExit: () => void }) {
  const players = useMemo(() => rankPlayers(Object.values((room.players ?? {}) as Record<string, Player>)), [room.players]);
  const question = room.questions[room.currentQuestionIndex];
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getCurrentUserId().then(setUserId).catch(() => setUserId(""));
  }, []);

  useEffect(() => {
    setSelected(null);
    setSending(false);
  }, [question?.id]);

  const answered = selected !== null || Boolean(question && userId && room.answers?.[question.id]?.[userId]);

  async function answer(index: number) {
    if (!question || answered) {
      return;
    }
    setSelected(index);
    setSending(true);
    try {
      await submitAnswer(room.code, question.id, index);
    } catch {
      setSelected(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <Page>
      <section className="room-shell">
        <RoomHeader room={room} onExit={onExit} />
        {room.phase === "lobby" && (
          <div className="player-lobby">
            <Users size={44} />
            <h1>You are in!</h1>
            <p>Waiting for the host to start. Players joined: {players.length}/{MAX_PLAYERS}</p>
            <LobbyList players={players} />
          </div>
        )}

        {room.phase === "question" && question && (
          <QuestionBoard question={question} startedAt={room.questionStartedAt ?? Date.now()}>
            <div className="answer-grid">
              {question.choices.map((choice, index) => (
                <motion.button
                  className={selected === index ? "answer-card selected" : "answer-card"}
                  disabled={answered || sending}
                  key={choice}
                  onClick={() => answer(index)}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                >
                  {choice}
                </motion.button>
              ))}
            </div>
            {answered && <p className="answer-note">Answer locked. Look up for the reveal.</p>}
          </QuestionBoard>
        )}

        {room.phase === "reveal" && question && <RevealPanel room={room} players={players} playerView onNext={() => undefined} onEnd={() => undefined} />}
        {room.phase === "finished" && <FinalLeaderboard players={players} onDelete={onExit} />}
      </section>
    </Page>
  );
}

function RoomHeader({ room, onExit }: { room: Room; onExit: () => void }) {
  return (
    <header className="room-header">
      <div>
        <p className="eyebrow">{room.code}</p>
        <h1>{room.title}</h1>
      </div>
      <button className="ghost-action" type="button" onClick={onExit}>
        Exit
      </button>
    </header>
  );
}

function LobbyList({ players }: { players: Player[] }) {
  return (
    <section className="lobby-list">
      <h2>
        <Users size={20} /> Players {players.length}/{MAX_PLAYERS}
      </h2>
      <div className="player-chips">
        <AnimatePresence>
          {players.map((player) => (
            <motion.span className={player.connected ? "player-chip" : "player-chip offline"} key={player.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              {player.nickname}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function HostQuestion({ room, players, onReveal, onEnd }: { room: Room; players: Player[]; onReveal: () => void; onEnd: () => void }) {
  const question = room.questions[room.currentQuestionIndex];
  const answeredCount = Object.keys(((room.answers ?? {}) as Record<string, unknown>)[question.id] ?? {}).length;

  return (
    <QuestionBoard question={question} startedAt={room.questionStartedAt ?? Date.now()}>
      <div className="host-stats">
        <span>{answeredCount}/{players.length} answered</span>
        <span>Question {room.currentQuestionIndex + 1}/{room.questions.length}</span>
      </div>
      <div className="host-controls">
        <button className="primary-action" type="button" onClick={onReveal}>
          Reveal answers
        </button>
        <button className="ghost-action" type="button" onClick={onEnd}>
          End game
        </button>
      </div>
    </QuestionBoard>
  );
}

function QuestionBoard({ question, startedAt, children }: { question: NonNullable<Room["questions"][number]>; startedAt: number; children: React.ReactNode }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, question.timeLimit - Math.floor((now - startedAt) / 1000));
  const progress = Math.max(0, Math.min(1, remaining / question.timeLimit));

  return (
    <section className="question-board">
      <div className="timer-ring" style={{ "--progress": progress } as React.CSSProperties}>
        {remaining}
      </div>
      <h1>{question.prompt}</h1>
      {children}
    </section>
  );
}

function RevealPanel({
  room,
  players,
  playerView,
  onNext,
  onEnd,
}: {
  room: Room;
  players: Player[];
  playerView?: boolean;
  onNext: () => void;
  onEnd: () => void;
}) {
  const question = room.questions[room.currentQuestionIndex];
  const answers = ((room.answers ?? {}) as Record<string, Record<string, { selectedIndex: number }>>)[question.id] ?? {};
  const counts = question.choices.map((_, index) => Object.values(answers).filter((answer) => answer.selectedIndex === index).length);

  return (
    <section className="reveal-panel">
      <p className="eyebrow">Correct answer</p>
      <h1>{question.choices[question.correctIndex]}</h1>
      <div className="results-bars">
        {question.choices.map((choice, index) => (
          <div className={index === question.correctIndex ? "result-row correct" : "result-row"} key={choice}>
            <span>{choice}</span>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(8, (counts[index] / Math.max(1, players.length)) * 100)}%` }} />
            <strong>{counts[index]}</strong>
          </div>
        ))}
      </div>
      <Leaderboard players={players.slice(0, 5)} />
      {!playerView && (
        <div className="host-controls">
          <button className="primary-action" type="button" onClick={onNext}>
            {room.currentQuestionIndex + 1 >= room.questions.length ? "Final leaderboard" : "Next question"}
          </button>
          <button className="ghost-action" type="button" onClick={onEnd}>
            End game
          </button>
        </div>
      )}
    </section>
  );
}

function Leaderboard({ players }: { players: Player[] }) {
  return (
    <ol className="leaderboard">
      {players.map((player, index) => (
        <li key={player.id}>
          <span>{index + 1}</span>
          <strong>{player.nickname}</strong>
          <em>{player.score}</em>
        </li>
      ))}
    </ol>
  );
}

function FinalLeaderboard({ players, hostActions, onDelete }: { players: Player[]; hostActions?: boolean; onDelete: () => void }) {
  return (
    <section className="final-board">
      <Crown size={54} />
      <h1>Final leaderboard</h1>
      <Leaderboard players={players} />
      <button className={hostActions ? "danger-action" : "primary-action"} type="button" onClick={onDelete}>
        {hostActions ? (
          <>
            <X size={18} /> Close room
          </>
        ) : (
          "Return home"
        )}
      </button>
    </section>
  );
}

export default App;
