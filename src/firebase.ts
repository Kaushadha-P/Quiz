import { initializeApp, type FirebaseApp } from "@firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "@firebase/auth";
import {
  child,
  get,
  getDatabase,
  goOffline,
  goOnline,
  onDisconnect,
  onValue,
  ref,
  remove,
  set,
  update,
  type Database,
} from "@firebase/database";
import { calculatePoints, createUniqueNickname, generateRoomCode, MAX_PLAYERS } from "./game";
import type { Answer, FirebaseConfigStatus, Player, QuizQuestion, Room } from "./types";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredKeys = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigStatus: FirebaseConfigStatus = {
  ready: requiredKeys.length === 0,
  missingKeys: requiredKeys,
};

let app: FirebaseApp | undefined;
let db: Database | undefined;

function database(): Database {
  if (!firebaseConfigStatus.ready) {
    throw new Error("Firebase is not configured. Add the VITE_FIREBASE_* values to .env.local.");
  }

  if (!app) {
    app = initializeApp(config);
    db = getDatabase(app);
  }

  return db!;
}

export async function ensureUser(): Promise<User> {
  if (!app) {
    database();
  }

  const auth = getAuth(app);
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
          return;
        }

        try {
          await signInAnonymously(auth);
        } catch (error) {
          unsubscribe();
          reject(error);
        }
      },
      reject,
    );
  });
}

export async function getCurrentUserId(): Promise<string> {
  const user = await ensureUser();
  return user.uid;
}

export function connectRealtime(): void {
  goOnline(database());
}

export function disconnectRealtime(): void {
  if (db) {
    goOffline(db);
  }
}

export async function createRoom(title: string, questions: QuizQuestion[]): Promise<string> {
  const user = await ensureUser();
  const rootRef = ref(database());

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRoomCode();
    const snapshot = await get(child(rootRef, `rooms/${code}`));
    if (!snapshot.exists()) {
      const now = Date.now();
      const room: Room = {
        code,
        hostId: user.uid,
        title,
        status: "lobby",
        phase: "lobby",
        createdAt: now,
        maxPlayers: MAX_PLAYERS,
        currentQuestionIndex: 0,
        questions,
      };
      await set(ref(database(), `rooms/${code}`), room);
      return code;
    }
  }

  throw new Error("Could not create a unique room code. Try again.");
}

export async function joinRoom(code: string, nickname: string): Promise<Player> {
  const user = await ensureUser();
  const roomSnapshot = await get(ref(database(), `rooms/${code}`));
  if (!roomSnapshot.exists()) {
    throw new Error("Room not found.");
  }

  const room = roomSnapshot.val() as Room;
  if (room.status !== "lobby" || room.phase !== "lobby") {
    throw new Error("This game already started.");
  }

  const players = Object.values((roomSnapshot.child("players").val() ?? {}) as Record<string, Player>);
  const returningPlayer = players.find((player) => player.id === user.uid);
  if (!returningPlayer && players.length >= MAX_PLAYERS) {
    throw new Error("This room is full.");
  }

  const player: Player = {
    id: user.uid,
    nickname: returningPlayer?.nickname ?? createUniqueNickname(nickname, players),
    score: returningPlayer?.score ?? 0,
    joinedAt: returningPlayer?.joinedAt ?? Date.now(),
    connected: true,
  };

  const playerRef = ref(database(), `rooms/${code}/players/${user.uid}`);
  await set(playerRef, player);
  await onDisconnect(playerRef).update({ connected: false });
  return player;
}

export function subscribeRoom(code: string, callback: (room: Room | null) => void): () => void {
  return onValue(ref(database(), `rooms/${code}`), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as Room) : null);
  });
}

export async function startGame(code: string): Promise<void> {
  await update(ref(database(), `rooms/${code}`), {
    status: "active",
    phase: "question",
    currentQuestionIndex: 0,
    questionStartedAt: Date.now(),
  });
}

export async function submitAnswer(code: string, questionId: string, selectedIndex: number): Promise<void> {
  const user = await ensureUser();
  const answer: Answer = {
    playerId: user.uid,
    questionId,
    selectedIndex,
    submittedAt: Date.now(),
  };
  await set(ref(database(), `rooms/${code}/answers/${questionId}/${user.uid}`), answer);
}

export async function revealQuestion(code: string, room: Room): Promise<void> {
  const question = room.questions[room.currentQuestionIndex];
  if (!question || !room.questionStartedAt) {
    return;
  }

  const snapshot = await get(ref(database(), `rooms/${code}`));
  const latest = snapshot.val() as Room;
  const answers = (latest.answers?.[question.id] ?? {}) as Record<string, Answer>;
  const players = (latest.players ?? {}) as Record<string, Player>;
  const updates: Record<string, unknown> = {
    [`rooms/${code}/phase`]: "reveal",
  };

  Object.values(answers).forEach((answer) => {
    const points = calculatePoints(question, answer, room.questionStartedAt!);
    updates[`rooms/${code}/answers/${question.id}/${answer.playerId}/isCorrect`] = answer.selectedIndex === question.correctIndex;
    updates[`rooms/${code}/answers/${question.id}/${answer.playerId}/points`] = points;
    updates[`rooms/${code}/players/${answer.playerId}/score`] = (players[answer.playerId]?.score ?? 0) + points;
  });

  await update(ref(database()), updates);
}

export async function nextQuestion(code: string, room: Room): Promise<void> {
  const nextIndex = room.currentQuestionIndex + 1;
  if (nextIndex >= room.questions.length) {
    await update(ref(database(), `rooms/${code}`), {
      status: "finished",
      phase: "finished",
    });
    return;
  }

  await update(ref(database(), `rooms/${code}`), {
    phase: "question",
    currentQuestionIndex: nextIndex,
    questionStartedAt: Date.now(),
  });
}

export async function endRoom(code: string): Promise<void> {
  await update(ref(database(), `rooms/${code}`), {
    status: "finished",
    phase: "finished",
  });
}

export async function deleteRoom(code: string): Promise<void> {
  await remove(ref(database(), `rooms/${code}`));
}
