# ALTER EGO — Handoff: What’s Built & How It Flows

This document describes the **current implementation** in this repo (mobile app + FastAPI backend + Supabase), so a new engineer can onboard without reading the whole codebase. Product vision and exact design tokens remain in **`CLAUDE.md`** at the repo root.

---

## 1. High-level architecture

| Layer | Stack | Location |
|--------|--------|----------|
| Mobile | React Native (Expo), TypeScript, NativeWind v4, Zustand, TanStack Query, React Navigation, Reanimated 3, react-native-svg | `alter-ego-mobile/` |
| Backend | FastAPI (Python 3.11), APScheduler | `alter-ego-backend/` |
| Database / Auth | Supabase (Postgres + Auth + RLS) | Configured via env; SQL in `alter-ego-backend/migrations/` |
| AI | Multiple LangGraph-style agents (OpenAI) for planner, nudges, twin chat, reports, quit/interest flows | `alter-ego-backend/app/agents/` |

**Auth model:** The app uses **Supabase Auth** on the client (`alter-ego-mobile/src/utils/supabase.ts`). The API expects a **Bearer JWT** on protected routes; the backend uses a **service-role** Supabase client for server-side writes that bypass RLS where needed.

**API base URL (mobile):** `EXPO_PUBLIC_API_URL` (see `alter-ego-mobile/src/services/api.ts`).

---

## 2. User journey (mobile navigation)

### 2.1 Root flow (`RootStack`)

1. **Splash** — Session check + onboarding progress hydrate; routes to SignUp, Onboarding, or Main.
2. **SignUp** — Account creation / sign-in entry (Supabase).
3. **Onboarding** — Question flow, archetype, 7-day framing, twin intro, notification permission.
4. **Main** — Tab app + modal stack (settings, journal, twin chat, sigil, paywall, etc.).

### 2.2 Onboarding stack (`OnboardingStack`)

Order (see `alter-ego-mobile/src/navigation/OnboardingStack.tsx`):

- OnboardingFraming → OnboardingQuestion (reused for multiple questions) → ArchetypeReveal → Onboarding7Day → TwinIntroduction → NotificationPermission  

Answers are held in **`OnboardingAnswersContext`**; steps sync to the backend via **`/api/v1/onboarding/*`** (see `alter-ego-mobile/src/services/onboarding.ts`).

### 2.3 Main app (`MainStack` + `MainTabNavigator`)

**Tabs (5):** Home · Leaderboard · Twin (center) · Report · Profile  

**Profile** is a nested **`ProfileStack`**: main profile hub → Abilities, Streak, Interests, Identity & Companion (Journey dropdown on profile hub), Quits.

**Stack screens (over tabs)** include: Settings subtree, Mail inbox, Twin chat, Rank card, Journal (list / editor / calendar), Day detail, Mission detail, **Sigil** (Aether Sigil — opened from Profile, not a tab), Paywall, Tone history, Shareable cards preview, Past report detail, Account/contact, etc.

---

## 3. Backend API surface (registered routers)

All routes are mounted from **`alter-ego-backend/main.py`**.

| Prefix | Module | Purpose (summary) |
|--------|--------|-------------------|
| `/api/v1/auth` | `auth.py` | Token verify, link Google, **`GET /me`** |
| `/api/v1` (onboarding) | `onboarding.py` | Onboarding step/progress, username check, create profile, complete onboarding |
| `/api/v1/missions` | `missions.py` | Today’s missions, completion, ratings, journal CRUD, personal missions, core difficulty, mission detail |
| `/api/v1/twin` | `twin.py` | Twin chat, history, tone rating/history, strip message, twin state |
| `/api/v1/leaderboard` | `leaderboard.py` | Leaderboard list + rank |
| `/api/v1/reports` | `reports.py` | Weekly report + detail + previous + day summary |
| `/api/v1/mail` | `mail.py` | Inbox, mark read / read all |
| `/api/v1/profile` | `profile.py` | Overview, streak, identity, companion, **interests** (CRUD + quests), legacy **`GET /quits`** alias |
| `/api/v1/settings` | `settings.py` | FAQ, username, notifications (push + timezone), feedback, delete account |
| `/api/v1/stats` | `stats.py` | Character stats bundle for abilities UI |
| `/api/v1/quits` | `quits.py` | Quit **paths** CRUD and path operations (frequency, phase, trigger profile) |
| `/api/v1/sigil` | `sigil.py` | **`GET /api/v1/sigil`** — sigil level, aether, surge, progress, history |

**Health:** `GET /health` on the app root.

---

## 4. Core product workflows (implemented)

### 4.1 Missions

- **Types:** Core, Interest, Resistance (quit-path), Personal (+ recovery in schema where used).
- **Today’s missions:** `GET /api/v1/missions/today` ensures core rows exist, syncs planner missions (interests + quit paths), returns grouped missions + summary.
- **Completion:** `POST /api/v1/missions/{id}/complete` updates mission, applies **daily XP/PF caps**, writes **`xp_log` / `pf_log`**, updates user totals, runs **streak**, **character stage**, **pet stage**, **power score**, **stat SP** awards, optional **Category C** in-app notifications, and **sigil / aether** (see §4.6).
- **Journal:** Missions can tie to journal; save flow can complete the journal mission when content qualifies (`mission_service` + journal rules).
- **Personal:** Estimate tier, create, delete; difficulty rating endpoint for missions.
- **Core pillar difficulty:** `POST /api/v1/missions/core/difficulty` (used with discipline DNA / recalibration flow).

**Mobile:** `HomeScreen` lists sections (Core, Focus/Interest, Resistance, Personal), completion via **`useCompleteMission`**, mission detail stack screen, journal FAB → journal stack.

### 4.2 Streaks & heatmap

- Backend streak processing runs on completion and in scheduled jobs (e.g. pet unlock / streak break handling).
- **Profile streak UI** uses **`GET /api/v1/profile/streak`** (heatmap, etc.).

### 4.3 Twin

- **Strip:** Rule-based (or data-driven) short message — `GET /api/v1/twin/strip`.
- **State / comparison data:** `GET /api/v1/twin/state`.
- **Chat:** `POST /api/v1/twin/chat` with history; **rate messages**, **tone rating** and **tone history** endpoints for UX feedback loops.

**Mobile:** Twin tab = comparison screen; chat is a stack modal when unlocked; tone history screen exists.

### 4.4 Interests (“path” / quests)

- Stored and served via **`/api/v1/profile/interests`** and related **PUT/PATCH/POST/DELETE** for difficulty, schedule, goal, quest criterion, quest complete.
- **Interest planner agent** generates interest missions for a date; **`sync_today_planner_missions`** in `mission_service` keeps today’s interest rows aligned with active interests.

**Mobile:** `ProfileInterestsScreen` + sheets/modals for manage, difficulty, schedule, goal, insights, etc.

### 4.5 Quits (resistance / quit paths)

- Primary API: **`/api/v1/quits`** (list, create, frequency, advance phase, delete, patch trigger profile).
- **`GET /api/v1/profile/quits`** remains a **legacy alias** that delegates to quit service.
- **Quit mission agent** + **quit insight / profile** agents support mission copy and profile tooling.
- Resistance missions on Home are tied to **quit paths** (`mission_service` sync).

**Mobile:** `ProfileQuitsScreen`, `quits` service, quit-related mission cards on Home.

### 4.6 Sigil / Aether / Surge

- **Schema:** `sigil_state`, `sigil_aether_log` (+ trigger on `users` insert). The repo includes **`migrations/019_sigil_clean_rebuild.sql`** as the **canonical clean** sigil schema; older files `009`–`012` are superseded if you apply `019` (drops prior sigil objects).
- **Surge:** When the user’s **logged XP for today** crosses their **daily XP cap** (by character stage, `DAILY_XP_CAPS` in `constants.py`), `surge_active` is set **true** on `sigil_state`.
- **Aether:** While surge is active (including the completion that triggered it), further mission completions award **aether** by difficulty; **all missions complete for the day** adds a bonus. Level is derived from total aether vs thresholds in **`constants.py`** (`SIGIL_LEVEL_THRESHOLDS`, `get_sigil_level`, `get_sigil_progress`).
- **Read API:** `GET /api/v1/sigil` returns level, totals, `surge_active`, nested **`progress`** (level progress bar fields), and **aether_history**.
- **Daily reset:** `reset_daily_surge` runs inside **`daily_mission_reset_job`** (local hour **1** per user) in **`scheduler.py`** — clears surge flag and `aether_today` for the new cycle.

**Mobile:** `useSigilData` → `fetchSigilData`; **SigilScreen** (animated sigils); **Profile** row + header mini preview (static only); **Home** shows **Surge** pill when `surge_active`, XP label **· SURGE**, **Aether toast** and **Sigil level-up overlay** on completion payload **`sigil`**.

### 4.7 Weekly reports & day reports

- **`GET /api/v1/reports/weekly`**, detail, previous, and **`GET /api/v1/reports/day/{date}`** for day drill-down.
- **Report agent** generates narrative sections per product rules.

**Mobile:** Report tab, past report detail, day detail screen.

### 4.8 Leaderboard & rank card

- **`GET /api/v1/leaderboard`**, **`GET /api/v1/leaderboard/rank`**.
- **Mobile:** Leaderboard tab, rank card stack screen, shareable preview where wired.

### 4.9 Mail (in-app inbox)

- **`GET /api/v1/mail`**, mark read / read all.
- Unread count typically surfaced on **profile overview**.

### 4.10 Settings & account

- FAQ, change username, **notifications** (push token + timezone — also called from **`App.tsx`** after permission), feedback webhook, **delete account**.

### 4.11 Character stats (abilities)

- **`GET /api/v1/stats`** feeds the abilities / stat progression UI.
- Mission completion returns **stat_gains** (primary SP, discipline, willpower bonus, etc.) consumed on Home (SP toast) and invalidated via query keys.

### 4.12 Paywall

- **Paywall** exists as a stack screen (trial / subscription UX). **`PaywallScreen`** notes phase without RevenueCat in comments — verify before shipping billing.

---

## 5. Background jobs (`app/core/scheduler.py`)

Runs on an **hourly** tick; most user-specific work runs only when **local hour is 1** (product choice):

| Job | Role |
|-----|------|
| `daily_mission_reset_job` | Ensure today’s core missions, sync planner missions, SP day alignment helpers, **reset_daily_surge** |
| `pet_unlock_check_job` | Pet unlock after enough days + streak break handling |
| `twin_simulation_job` | Twin day simulation + strip update |
| `user_local_maintenance_job` | Batched local-time maintenance (power score, mail, etc. — see implementation) |
| `weekly_report_local_job` | Sunday 03:00 local weekly report generation path |
| `twin_recalibration_job` | Twin / DNA recalibration cadence |
| `nudge_check_job` | Push / nudge pipeline (Category A/B/C inside agent) |

---

## 6. AI agents (`app/agents/`)

Implemented modules include (names indicate responsibility):

- **interest_planner_agent** — interest missions for a date  
- **interest_normaliser** — interest naming/normalisation  
- **Core missions (no agent)** — static season/phase specs in `constants.py`, assembled in `mission_service.generate_core_missions_for_user`  
- **quit_mission_agent**, **quit_insight_agent**, **quit_profile_agent** — quit path missions and copy  
- **twin_chat_agent** — twin chat responses  
- **report_agent** — weekly report generation  
- **nudge_agent** — nudges + Category C notifications  
- **personal_mission_agent** — personal mission assistance where used  
- **base** — shared agent infrastructure  

Exact triggers are in services (e.g. `mission_service`, `scheduler`, `twin`, `mail`).

---

## 7. Database migrations

SQL files live in **`alter-ego-backend/migrations/`** (`001` … `019`). Apply in order on a fresh DB; for **sigil**, prefer **`019_sigil_clean_rebuild.sql`** if you need the current schema (and understand it **drops** prior sigil tables).

Notable themes in migrations: initial schema, intervention hour / nudges, journal fields, twin tone ratings, character stats, missions `stat_tag`, quit paths system, interest path state, discipline DNA / core mission columns, twin chat enhancements, weekly report columns, recalibration schedule, **sigil rebuild**.

---

## 8. Mobile app structure (where to look)

| Area | Path |
|------|------|
| API client + errors | `src/services/api.ts` |
| Feature services | `src/services/*.ts` (missions, profile, twin, quits, sigil, stats, …) |
| Global state | `src/store/authStore.ts`, `userStore.ts` |
| Query hooks | `src/hooks/*.ts` |
| Navigation | `src/navigation/*` |
| Screens | `src/screens/*.tsx` |
| Sigil visuals | `src/components/sigil/*`, `src/constants/sigils.ts` |
| Providers | `src/providers/AppProviders.tsx` |

**Rule of thumb:** Screens should use **`apiClient`** and stores — not raw `fetch` / not `supabase.auth` in screens (session via auth store / `api.ts`).

**Mock API:** `EXPO_PUBLIC_USE_MOCK_API` switches some legacy paths in `src/utils/api.ts`; **sigil mock** is in `src/utils/apiMock.ts` (`getProfileSigilMock`).

---

## 9. Environment & operations checklist

**Backend (`.env` in `alter-ego-backend/`):**  
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, plus optional keys for PostHog, email, feedback webhooks (see `CLAUDE.md` §11).

**Mobile:**  
`EXPO_PUBLIC_API_URL`, Supabase keys in app config / `.env` as used by `supabase.ts`.

**Deploy:** Run migrations on Supabase → deploy FastAPI with env → point mobile `EXPO_PUBLIC_API_URL` at the API → EAS/build for stores.

---

## 10. Gaps / things to verify (not exhaustive)

- **Payments:** Paywall UI exists; confirm RevenueCat (or chosen IAP) before production billing.  
- **TypeScript:** Full-project `tsc` may still report issues outside the sigil/mission paths; run `npx tsc --noEmit` in `alter-ego-mobile` before release.  
- **Duplicate migration history:** If an environment already ran `009–012`, coordinate **`019`** vs incremental alters to avoid data loss.  
- **Spec vs code:** `CLAUDE.md` describes the full product; some cinematic H1–H6 or leaderboard gates may be partially implemented — treat this handoff as **code-first**, CLAUDE as **intent**.

---

## 11. Single-page “day in the life” summary

1. User opens app → Splash routes to Main or Onboarding.  
2. **Home** loads **`/missions/today`** + profile/streak/twin strip as needed.  
3. User completes missions → **`/missions/{id}/complete`** → XP/PF, caps, streak, stages, stats, **sigil** payload; mobile shows toasts/overlays and invalidates caches.  
4. **Twin** tab and **Twin chat** use twin APIs; **Report** tab uses reports APIs.  
5. **Profile** deep-links to abilities, streak, interests, journey (identity/companion), quits, and **Aether Sigil** (`SigilScreen` on root stack).  
6. Overnight / local 1am jobs reset daily mission scaffolding, surge/aether daily fields, pet/streak/twin maintenance, nudges, weekly report when Sunday 03:00 local.

---

*Generated from repository inspection. Update this file when you add major routes, screens, or migrations.*
