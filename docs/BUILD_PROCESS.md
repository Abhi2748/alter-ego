# ALTER EGO — Build Process Log

This file documents the implementation of the Theme Redesign, The Factor, and Roadmap to Scale (plan attached in `.cursor/plans/`). Build order: Phase A → B → C → D → E → F.

---

## Phase A — Lock and document (DONE)

- **CLAUDE.md §1 updated:** Tagline set to "Your rival is you — one week ahead." with optional subtitle. Added **§1.1 Theme & Factor** (middle ground, 14-day adaptation, the factor, in-app north star).
- **docs/PRODUCT_AND_COPY.md created:** Key lines per screen (splash, sign-up, onboarding, Twin intro, Home, Twin, paywall, day 14 optional, transparency).

---

## Phase B — Backend (DONE)

- **alter-ego-backend/supabase/schema.sql:** Full DDL for users, missions, character_state, pet_state, twin_state, twin_chat, streak_log, leaderboard_scores, weekly_reports, nudges. RLS on all tables. `users` has optional `motivation_preference`. Run in Supabase SQL editor.
- **alter-ego-backend/utils:** `supabase_client.py` (get_supabase), `auth.py` (get_user_id from Bearer JWT via SUPABASE_JWT_SECRET).
- **alter-ego-backend/models:** Pydantic models for onboarding, missions, twin, user.
- **alter-ego-backend/routes:** auth (callback stub), onboarding (POST, upsert user + trial_start_date), user (GET/PATCH /me), missions (GET, POST, PATCH), twin (POST /chat, GET /state), leaderboard (GET), agents (profile/plan/nudge/weekly-report/oracle-line stubs).
- **alter-ego-backend/agents/twin_agent.py:** Shadow Twin chat via LangChain OpenAI (gpt-4o-mini), system prompt from CLAUDE, persists user + twin messages to twin_chat.
- **main.py:** FastAPI app with /api/v1 prefix, CORS, all routers. /health kept.

**Requirements added:** PyJWT, httpx, langchain-core.

**Env required:** SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET, OPENAI_API_KEY.

---

## Phase C — Mobile: theme and factor in copy (DONE)

- **SplashScreen:** Tagline changed to "Your rival is you — one week ahead."
- **SignUpScreen:** Line under auth buttons: "We'll learn how you work. Your only job: show up."
- **TwinIntroductionScreen:** Gap text → "Your rival is you — one week ahead." Added "Your first 14 days we learn how you work best. You just show up." and transparency line ("We use how you use the app to personalize your experience. We don't sell your data.").
- **HomeScreen:** Added "Today's ask" label above mission sections.
- **PaywallScreen:** Headline/subhead → "You showed up 14 days." / "We've learned how you work. Continue with a plan that fits you."

---

## Phase D — Mobile: animations and polish (IN PROGRESS)

- **Press scale (0.97):** SignUp auth buttons (already had), OnboardingFraming Continue (already had), TwinIntroduction Begin (existing), PaywallScreen CTA — added Reanimated scale on CTA. MissionCard already had press scale.
- **Card appear stagger:** MissionCard accepts optional `appearIndex`; opacity 0→1 and translateY 12→0 with delay (staggerDelay × index, cap staggerMax). HomeScreen passes index to Core, Today's Focus, and Personal mission cards.
- **Twin strip glow:** Already implemented in TwinAlertStrip on `hasNewMessage`.
- **Mission complete burst:** On swipe-to-complete, MissionCard animates translateX to 500 and opacity to 0 (missionBurst duration), then calls onComplete(). HomeScreen removes completed mission from list (filter by id) so card disappears after exit.
- **XP bar fill:** Already implemented (XPProgressBar ref `animateXpGain()`, 260ms).
- **Evolution overlay:** CharacterEvolutionOverlay currently simple fade in/out + 2.5s show. Plan: 6-phase cinematic (backdrop → title → character → hold → fade out) — to complete.
- **LinearGradient root:** Screens already use it per CLAUDE.

---

## Phase E — Adaptation logic (DONE)

- **Backend utils/adaptation.py:** `get_trial_day`, `should_show_what_we_learned`, `compute_mission_count_from_completion_rate`, `compute_difficulty_mix`, `get_tone_blend_from_archetype`, `what_we_learned_bullets`. Used by Planner (when implemented) and by GET /user/what-we-learned.
- **GET /user/what-we-learned:** Returns `{ trial_day, show, bullets }` when user is on day 14 and still on trial. App can show "What we learned" modal before/with paywall.
- **Mobile WhatWeLearnedModal:** Component in `src/components/WhatWeLearnedModal.tsx`. PaywallScreen (or parent) can call API and show this modal when `show === true` and `bullets.length > 0`; user taps Continue to close.
- Transparency line already in Twin intro.

---

## Phase F — Scale-ready (DOCUMENTED; integration pending)

- **Analytics:** PostHog (or similar). Key events: `sign_up`, `onboarding_complete`, `mission_complete`, `twin_chat_open`, `paywall_view`, `subscribe`. Add `posthog.capture()` (or equivalent) in mobile at each step; backend can send server-side events if needed.
- **ASO:** App store title/subtitle and short description should use: "Your rival is you — one week ahead." and "We learn you in 14 days. Your only job: show up." Update `app.json` / `app.config.js` name and description when publishing.
- **Rating prompt:** Show App Store review prompt once, on a random day between Day 4 and Day 12 (use `rating_prompted_at` in users table). After user rates or dismisses, set `rating_prompted_at` so we don’t ask again.
- **RevenueCat:** Product ID `alter_ego_monthly`; 14-day free trial, then $9/month. Integrate RevenueCat SDK in mobile; gate full access after trial using `subscription_status` from backend or RevenueCat entitlement. See RevenueCat docs for Expo/React Native.

See **docs/SCALE_READY_CHECKLIST.md** for a step-by-step Phase F checklist when you’re ready to integrate.

---

## How to run

- **Backend:** `cd alter-ego-backend && pip install -r requirements.txt && uvicorn main:app --reload`. Set .env (SUPABASE_*, OPENAI_API_KEY).
- **Mobile:** `cd alter-ego-mobile && npx expo start --clear`.
- **Supabase:** Run `supabase/schema.sql` in project SQL editor before using backend.

---

## Changelog (summary)

| Date / session | What changed |
|----------------|--------------|
| Plan implementation start | Phase A: CLAUDE.md §1.1, PRODUCT_AND_COPY.md. Phase B: schema, routes, Twin agent. Phase C: all copy updates. Phase D: MissionCard stagger + exit, HomeScreen mission removal, Paywall CTA press scale, CharacterEvolutionOverlay 6-phase cinematic. |
| Continued build | Phase E: utils/adaptation.py, GET /user/what-we-learned, WhatWeLearnedModal component. Phase F: documented in BUILD_PROCESS (analytics, ASO, rating, RevenueCat); implementation is integration work when ready. BUILD_PROCESS.md created to document whole process. |

---

*Update this file as you complete each phase or make notable changes.*
