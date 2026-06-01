declare module "@firebase/auth" {
  import type { FirebaseApp } from "@firebase/app";

  export interface User {
    uid: string;
  }

  export interface Auth {
    currentUser: User | null;
  }

  export function getAuth(app?: FirebaseApp): Auth;
  export function signInAnonymously(auth: Auth): Promise<{ user: User }>;
  export function onAuthStateChanged(
    auth: Auth,
    nextOrObserver: (user: User | null) => void,
    error?: (error: Error) => void,
  ): () => void;
}
