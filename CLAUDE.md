# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TravelCheckinApp ("SmartData AI-Flow") — a full-stack travel management platform with POS/PMS modules. Three independently managed sub-projects sharing one repo.

## Commands

### Backend (`backend/`)
```bash
cd backend
npm install
npm run dev          # nodemon + ts-node (hot reload)
npm run build        # tsc → dist/
npm start            # node dist/server.js
```

### Website (`website/`)
```bash
cd website
npm install
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run lint         # eslint .
npm run preview      # vite preview
```

### Mobile (`mobile/`)
```bash
cd mobile
npm install
npm start            # expo start
npm run android      # expo start --android
npm run ios          # expo start --ios
```

### Database
The full MySQL schema is in `TravelCheckinApp.sql` (155 KB). Import it into MySQL to set up the database.

## Architecture

### Backend (Node.js + Express 5 + TypeScript)
- **Layered pattern:** Routes → Controllers → Services → Models (SQL queries)
- Controllers: validate input (Zod), call services, return responses
- Services: business logic (payments, vouchers, AI)
- Models: raw SQL via `mysql2/promise` pool with prepared statements (`?`)
- **Auth:** JWT with single-session enforcement (sessionId in token + `active_sessions` table). Middleware: `authenticateToken`, `requireRole`, `authenticateTokenOptional`
- **Roles:** `user`, `owner`, `employee`, `admin` (owners need admin approval)
- **Real-time:** Socket.IO for session revocation (`src/utils/socketHub.ts`), SSE for push notifications (`src/utils/realtime.ts`)
- **File uploads:** Multer → `backend/uploads/`
- Entry point: `src/server.ts`

### Website (React 19 + Vite 7 + TypeScript)
- **Routing:** React Router DOM v7, lazy-loaded pages, `ProtectedRoute` for role-based access
- **API layer:** Domain-specific Axios clients in `src/api/` with shared `axiosClient.ts` (auto-attach Bearer token, handle 401/403/session-revoked)
- **State:** Zustand + sessionStorage for auth tokens
- **UI:** Ant Design v6 + TailwindCSS
- **Maps:** Leaflet + React-Leaflet (manual chunk in Vite config)
- **Three layouts:** `MainLayout` (admin sidebar), `UserLayout`, `FrontOfficeLayout` (POS/PMS)
- **POS/PMS module:** `src/modules/frontOffice/` with Hotel, Restaurant, Tourist venue pages

### Mobile (Expo SDK 54 + React Native — early stage)
- Current `App.tsx` is a connection test screen, not yet integrated with planned architecture
- Planned: React Navigation, Zustand stores, Context API (Auth/Location/Theme)
- API base URL hardcoded in `mobile/src/api/axiosClient.ts`

## Coding Standards (BẮT BUỘC / MANDATORY)

These rules from `docs/AI_RULES.md` must be followed:

- **No emojis/icons in source code** — never use emoji characters in variable names, strings, or code comments. Only in `.md` docs.
- **Comments in Vietnamese** — explain *why*, not *what*. Required for interfaces, complex functions, and business logic.
- **No `any` type** — always define explicit `interface` or `type`. Website ESLint has `@typescript-eslint/no-explicit-any: "error"`.
- **Interfaces must match DB schema** exactly (e.g., `users` table has `address` column, `vouchers` has `apply_to_service_type`).
- **SQL: use prepared statements** with `?` placeholders. Never modify DB schema from code.
- **Backend:** Controller/Service/Model separation. No `console.log` — use `logger` or `next(error)`. Wrap all async in try/catch.
- **Frontend:** UI components receive props only. API calls and state logic go in custom hooks (e.g., `useAuth`, `useBookings`). Website uses TailwindCSS (no inline styles). Mobile uses `StyleSheet.create`.
- **Performance:** Use `useMemo`/`useCallback` for complex computations. Use `FlatList` not `ScrollView` for long lists on mobile.

## Environment Variables

**Backend** (`backend/.env` — see `backend/.env.example`): `PORT`, `DB_*`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, `EMAIL_*`, `GOOGLE_CLIENT_*`, `FACEBOOK_*`, `CORS_*`, `API_URL`, `FRONTEND_URL`

**Website** (`website/.env`): `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_MAPBOX_TOKEN`

## Linting

Only the website has ESLint configured. Run `cd website && npm run lint`. Backend and mobile have no linter.

## No Tests

No testing framework is configured in any sub-project. There are no test scripts, test files, or test dependencies.

## Key Docs (Vietnamese)

- `docs/AI_RULES.md` — mandatory coding standards
- `docs/backend.md` — backend architecture guide
- `docs/website.md` — website architecture guide
- `docs/mobile.md` — mobile architecture guide
- `docs/service.md` — planned AI microservice (Python/FastAPI)
- `docs/endpoint-audit.md` — 237 backend endpoints audited against 188 website calls
