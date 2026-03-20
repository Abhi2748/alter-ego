# Closed beta prep — change log

Session: **2026-03-19**  
Scope: streak achievement UI, closed-beta auth/paywall gating (frontend only), documentation. **No backend behaviour changes.**

---

## 1. Streak achievement animation (HTML → React Native)

**Source mockup:** repo root `ALTER_EGO_StreakAnimation.html` (also copied to `Alter-Ego-streakanimation.html` per naming request).

**New files**

| File | Purpose |
|------|---------|
| `alter-ego-mobile/src/constants/streakAnimationTiers.ts` | Tier colours, sizes, ornaments, thresholds (`>= 30/60/100/200/365` like HTML), milestone copy, ordinal helper |
| `alter-ego-mobile/src/components/streak/StreakOrnament.tsx` | SVG ornaments: `ticks_30`, `double_ring`, `triple_ring`, `star_compass`, `sun_rose` |
| `alter-ego-mobile/src/components/StreakAchievementOverlay.tsx` | Full-screen modal: bloom, shockwave, spinning dashed rings, seal ring, gradient number (MaskedView), labels, auto-dismiss 5s + tap, exit fade ~350ms |

**Wiring**

- `alter-ego-mobile/src/screens/HomeScreen.tsx` — when `completeMission` returns `streak_animation.show`, shows `StreakAchievementOverlay` with `streak_count`; `onDismiss` clears local state.

**Backend**

- Unchanged. Still uses existing `mission_service.complete_mission` → `streak_animation` payload from `streak_service.process_streak`.

**Visual parity notes**

- Timings aligned to mockup keyframes (overlay 250ms, bloom 800ms, shock delay 720ms, ring stamp 380ms, hero stamp 550ms, etc.).
- Tier visuals for intermediate streak days (e.g. 31–59) follow HTML `getTier(n)` rule (`>= 30` → gold-tier styling), not the backend’s exact-milestone-only `animation_tier` string.

---

## 2. Closed beta: Google + Sign in later; no subscription row

**New file**

- `alter-ego-mobile/src/constants/closedBeta.ts` — `IS_CLOSED_BETA` when `EXPO_PUBLIC_CLOSED_BETA=true` or `1`.

**Updated files**

- `alter-ego-mobile/src/screens/SignUpScreen.tsx` — if `IS_CLOSED_BETA`: hide Apple and Email buttons; email modal forced closed.
- `alter-ego-mobile/src/screens/SettingsScreen.tsx` — if `IS_CLOSED_BETA`: hide “Subscription” row (Paywall still exists in stack for non-beta builds).

**Config**

- `alter-ego-mobile/.env.example` — documents `EXPO_PUBLIC_CLOSED_BETA`.

---

## 3. Not done in this pass (your next steps)

- Set `EXPO_PUBLIC_CLOSED_BETA=true` in local `.env` for beta builds.
- End-to-end test on device using Wi‑Fi IPv4 `EXPO_PUBLIC_API_URL`.
- Security / abuse review and responsive QA across devices (as you planned).
- Typecheck: project has pre-existing `tsc` errors unrelated to these files; no new errors reported by IDE linter on touched files.

---

## 4. Files touched (summary)

- `alter-ego-mobile/src/screens/HomeScreen.tsx`
- `alter-ego-mobile/src/screens/SignUpScreen.tsx`
- `alter-ego-mobile/src/screens/SettingsScreen.tsx`
- `alter-ego-mobile/.env.example` (new)
- `Alter-Ego-streakanimation.html` (copy of streak mockup)
- `docs/CLOSED_BETA_PREP_LOG.md` (this file)

Plus new: `streakAnimationTiers.ts`, `StreakOrnament.tsx`, `StreakAchievementOverlay.tsx`, `closedBeta.ts`.

---

## 5. E2E wiring fixes (splash → backend contracts, no backend code changes)

**Session: 2026-03-19 (follow-up)**

| Change | Detail |
|--------|--------|
| Onboarding resume | [`onboardingProgressHydrate.ts`](../alter-ego-mobile/src/utils/onboardingProgressHydrate.ts) maps server `answers` → `OnboardingAnswers`; [`OnboardingFramingScreen.tsx`](../alter-ego-mobile/src/screens/OnboardingFramingScreen.tsx) calls `GET /api/v1/onboarding/progress`, resets to Main if `onboarding_complete`, else hydrates + `replace` to first incomplete question (2–14). Guest mode skips API. Brief loading spinner while fetching. |
| Feedback API | [`ContactUsScreen.tsx`](../alter-ego-mobile/src/screens/ContactUsScreen.tsx) → `POST /api/v1/settings/feedback` with `{ type: bug\|concern\|suggestion, content, app_version }` via `apiClient`. |
| Delete account | [`SettingsScreen.tsx`](../alter-ego-mobile/src/screens/SettingsScreen.tsx) → `DELETE /api/v1/settings/account` via `apiClient` (was wrong path `/api/v1/user/account`). |
| Username check (legacy) | [`utils/api.ts`](../alter-ego-mobile/src/utils/api.ts) `checkUsername` URL → `/api/v1/users/check-username`. |
| Paywall (closed beta) | [`PaywallScreen.tsx`](../alter-ego-mobile/src/screens/PaywallScreen.tsx) — if `IS_CLOSED_BETA`, shows “Included in closed beta” + Done (deep link / future entry still safe). |
| API noise | Removed debug `console.log` from [`api.ts`](../alter-ego-mobile/src/services/api.ts) `getAuthHeader`. |
| Docs | [`CLOSED_BETA_E2E_CHECKLIST.md`](CLOSED_BETA_E2E_CHECKLIST.md) — ordered verify list; [`.env.example`](../alter-ego-mobile/.env.example) — staging vs LAN notes. |

**Note:** `onboardingProgressHydrate` must stay aligned with `QUESTION_KEYS` / archetype maps in `OnboardingQuestionScreen.tsx` (comment in hydrate file).
