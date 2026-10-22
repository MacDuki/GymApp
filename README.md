# 🏋️ GymApp — Offline Gym Workout Tracker PWA

A **fast, offline-first workout tracker** built as a Progressive Web App (PWA), designed to be used on your **iPhone at the gym** — with no internet connection during normal use.

Everything runs locally on your device: routines, workouts, history, progress tracking and bodyweight data are stored in **IndexedDB**, so the app works 100% offline after the first install.

---

## ✨ Features

### 🗂️ Routine Management
- Create, rename, view, edit and delete routines.
- Each routine is made of flexible **blocks/sections**, each containing its own exercises.
- Add, rename, delete and reorder blocks.
- Add, edit, delete and reorder exercises inside each block.
- Configure **sets**, **target reps** (single value or ranges like `8-12`), **rest duration** and optional **notes** per exercise.
- No fixed structure imposed — routines can have any number of blocks and exercises.

### ▶️ Active Workout
- Start any routine and work through it exercise by exercise.
- Large, one-handed-friendly touch targets optimized for iPhone.
- Record **weight** and **reps** per set and mark sets as completed.
- **Autosaves** every change to IndexedDB instantly.
- View **previous performance** for each exercise.
- Receive a **simple progressive-overload suggestion** based on your last workout.
- **MANUAL TIMER** — a circular timer that starts only when requested; timed exercises count down from their target and support `+10s`, while other exercises count upward freely.
- Blocks stay visually grouped so you always know where you are in the routine.
- Progress is preserved when navigating between exercises.

### 💾 Resume & Reliability
- If you close or reload the app mid-workout, you can **resume** it (or discard it).
- Workout data is written to IndexedDB in real time, not just kept in React state.

### 📜 Workout History
- Chronological list of completed workouts with **date** and **total volume** (`weight × reps` summed).
- Drill into any workout to see every exercise and set, including completion status.
- Historical workouts are **snapshotted** — editing a routine later never rewrites old history.
- Discarded workouts are kept in a recycle bin for 7 days and can be restored or permanently deleted.

### 📈 Progress Tracking
- Per-exercise weight progression chart.
- Track **highest weight**, **highest volume** and reps across workouts.
- **PR (personal record)** highlights.
- Optional **bodyweight** tracker with its own progression chart — independent of workouts.

### 📦 Data Backup
- **Export** all data (routines, workouts, recycle bin and bodyweight) to a JSON file.
- **Import** a JSON backup to restore everything.
- **Delete all data** (with confirmation) when you want to start fresh.
- Local-first by design — **no cloud sync**, no accounts, no external services.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+) and **npm**

### Install & Run locally
```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

### Production build
```bash
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS |
| Persistence | IndexedDB (via `idb`) |
| PWA / Offline | `vite-plugin-pwa` (Service Worker + Web App Manifest) |

**Deliberately minimal dependencies.** No backend, no authentication, no external APIs, no CDN resources.

---

## 📁 Project Structure

```text
src/
  components/     # (UI components — colocated in pages for simplicity)
  pages/          # App.tsx renders the main views (Home, Routines, Workout, History, Progress, Settings)
  hooks/          #
  services/       #
  db/             # IndexedDB wrapper (all persistence operations)
  types/          # Shared TypeScript types & data model
  utils/          # Helpers: id, volume, progression
  data/           # Seed routines (weekly split)
```

The architecture is intentionally **simple and pragmatic** — UI components, application logic and IndexedDB access are separated enough to stay maintainable, without over-engineering.

---

## 🗄️ Data Model

All persistent data lives in IndexedDB under four object stores:

- **`routines`** — routines with nested `blocks[]` → `exercises[]`
- **`workouts`** — completed (and active) workouts with their own exercise/set snapshot
- **`bodyweights`** — dated bodyweight entries
- **`kv`** — key/value storage (used for the active-workout resume state)

```ts
Routine { id, name, createdAt, blocks[] }
Block   { id, routineId, name, order, exercises[] }
Exercise{ id, blockId, name, order, sets, targetReps, restSeconds, notes? }
Workout { id, routineId, routineName, snapshot, startedAt, completedAt?, exercises[] }
WorkoutSet { weight, reps, completed }
BodyweightEntry { id, date, weight }
```

**Important:** historical workouts store their own snapshot of exercises/sets, so they never depend on the current routine definition.

---

## 📱 PWA / iPhone Setup

The app is configurable as a home-screen PWA on iPhone Safari:

1. Open the deployed app in **Safari**.
2. Tap **Share** → **Add to Home Screen**.
3. Open from the Home Screen — the app launches **standalone** (no browser chrome) and works **offline**.

It includes:
- Web App Manifest (`display: standalone`, theme/background color, icons)
- Service Worker caching all static assets
- Safe-area inset handling (notch / Dynamic Island)
- Mobile-first UI with bottom navigation and large touch targets

### Deploying
The PWA service worker and manifest are generated automatically at build time. Deploy the contents of the `dist/` folder to any static host (GitHub Pages, Netlify, Vercel, etc.).

---

## 🌱 Seeded Routine

On first launch (empty database), the app seeds a full **weekly split** so you can start using it immediately:

- **LUNES — PUSH**
- **MARTES — PULL**
- **MIÉRCOLES — LEGS A**
- **JUEVES — UPPER**
- **VIERNES — LEGS B**
- **SÁBADO — FULL BODY**

Each includes mobility, core, calves/forearms and a main routine, structured across multiple blocks. The seed routines are fully editable and deletable like any user-created one.

---

## 🧭 UI / UX

- **Dark, premium, gym-focused** visual design.
- Large touch targets and strong visual hierarchy.
- Bottom navigation: **Home · Routines · History · Progress · Settings**.
- The workout screen prioritizes **speed and usability** over aesthetics.
- Visible focus states, semantic HTML, keyboard accessibility where relevant.

---

## ⚙️ Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc`) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript type-checking only |

---

## 📄 License

Private project.
