# Quiz Spark

Quiz Spark is a Kahoot-style real-time quiz app for classrooms, meetups, and small events. Hosts create session-only quizzes, players join with a room code, and Firebase Realtime Database keeps lobbies, answers, and leaderboards live.

## Features

- Host-created questions with 2-4 choices and per-question timers.
- Short room codes and animated waiting lobby.
- Up to 30 players per session.
- Anonymous Firebase Auth, no paid subscription, no user accounts.
- Speed-based scoring and live leaderboards.
- GitHub Pages deployment workflow.

## Local Setup

1. Create a Firebase project.
2. Enable Anonymous Authentication.
3. Create a Realtime Database.
4. Copy `.env.example` to `.env.local` and fill in the Firebase web app values.
5. Install and run:

```bash
npm install
npm run dev
```

## Firebase Rules

Import `firebase.database.rules.json` into Firebase Realtime Database Rules before production use.

## GitHub Pages Deploy

1. Push this repo to GitHub.
2. Add these repository secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. In repository settings, set Pages source to GitHub Actions.
4. Push to `main`.

If your repository is served from a subpath, set `VITE_BASE_PATH` in the workflow or repository variables to `/<repo-name>/`.
