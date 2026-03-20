# Closed beta — end-to-end wiring checklist

Single ship list: **verify each row on a real device** against your staging/closed-beta backend.  
Mobile API base: `EXPO_PUBLIC_API_URL` in [`alter-ego-mobile/.env.example`](../alter-ego-mobile/.env.example).

**Operator prep (env, OAuth, smoke tests):** [`BETA_READINESS.md`](./BETA_READINESS.md)

**Code alignment (2026-03-19):**

- Contact / feedback: `POST /api/v1/settings/feedback` with `{ type, content, app_version }` — [`ContactUsScreen.tsx`](../alter-ego-mobile/src/screens/ContactUsScreen.tsx)
- Delete account: `DELETE /api/v1/settings/account` — [`SettingsScreen.tsx`](../alter-ego-mobile/src/screens/SettingsScreen.tsx) via `apiClient`
- Legacy `utils/api.ts` username check: `GET /api/v1/users/check-username` (matches backend)
- Onboarding resume: `GET /api/v1/onboarding/progress` on [`OnboardingFramingScreen`](../alter-ego-mobile/src/screens/OnboardingFramingScreen.tsx); hydrates context + `replace` to first incomplete question (1–14)
- Leaderboard: backend unlocks with `subscription_tier == "beta_free"` or `leaderboard_unlocked`; new profiles from `create-profile` path use `beta_free` in onboarding service
- Paywall: with `EXPO_PUBLIC_CLOSED_BETA=true`, [`PaywallScreen`](../alter-ego-mobile/src/screens/PaywallScreen.tsx) shows “Included in closed beta” (no purchase)

---

## 1) Environment and build

- [ ] `EXPO_PUBLIC_API_URL` = staging/beta HTTPS URL for store/internal builds; LAN IP only for local device testing
- [ ] Beta server: Supabase service key, OpenAI, cron/worker host, `ZAPIER_WEBHOOK_URL` (if used) set
- [ ] Google OAuth: Supabase + Google Cloud client IDs, bundle ID / package name, redirect URLs for **dev** vs **store** builds

## 2) Splash → auth routing

- [ ] Splash ~2.5s then routes: no session → Sign up; guest token → Onboarding; else `createProfile` + `GET /api/v1/auth/me` → Main vs Onboarding
- [ ] Cold start: persisted Supabase session restores; no dead end
- [ ] Brief network blip: Splash retries bootstrap once before Sign up (non-auth errors only)

## 3) Google + Sign in later only (closed beta)

- [ ] With `EXPO_PUBLIC_CLOSED_BETA=true`: Apple + email hidden on sign-up
- [ ] Google: full OAuth round-trip, session persisted, `authStore.initialize` / `onAuthStateChange` consistent
- [ ] Sign in later: anonymous or guest path; `createProfile` where applicable; `GET /auth/me` drives Main vs Onboarding
- [ ] Single source of truth: `onboarding_complete` from **`GET /api/v1/auth/me`** (Splash + SignUp); progress resume from **`GET /api/v1/onboarding/progress`**

## 4) Post-auth bootstrap

- [ ] `POST /api/v1/users/create-profile` idempotent after auth
- [ ] `AppProviders`: `fetchProfile()` after auth (deferred) — [`userStore`](../alter-ego-mobile/src/store/userStore.ts)
- [ ] Push + timezone (optional): [`App.tsx`](../alter-ego-mobile/App.tsx) — failures should not block UX

## 5) Onboarding stack

- [ ] Each step: `POST /api/v1/onboarding/step`
- [ ] Kill app mid-flow → reopen → resume from saved progress (framing screen fetch)
- [ ] Final: `POST /api/v1/onboarding/complete` → Main; no duplicate submit loops

## 6) Main loop

- [ ] `GET /api/v1/missions/today` — empty/error/retry states
- [ ] `POST /api/v1/missions/{id}/complete` — XP / PF / streak / `streak_animation` when applicable
- [ ] Personal missions + journal flows hit real API paths in [`missions.ts`](../alter-ego-mobile/src/services/missions.ts)

## 7) Twin

- [ ] Strip: `GET /api/v1/twin/strip`
- [ ] Comparison: `GET /api/v1/twin/state`
- [ ] Chat: history + `POST /api/v1/twin/chat`

## 8) Leaderboard / reports

- [ ] Leaderboard: expect 200 for `beta_free` users; 403 = locked — UI shows error from [`LeaderboardScreen`](../alter-ego-mobile/src/screens/LeaderboardScreen.tsx)
- [ ] Weekly report: `GET /api/v1/reports/weekly` — empty state OK

## 9) Subscription off for closed beta

- [ ] No auto-navigation to Paywall that blocks tabs (verify in app)
- [ ] `IS_CLOSED_BETA` Paywall copy; Settings subscription row hidden
- [ ] Backend: no middleware gating missions/twin (confirmed: subscription helper unused in routes)

## 10) Settings and account

- [ ] Logout clears session + navigates to Sign up
- [ ] Feedback sends to `POST /api/v1/settings/feedback`
- [ ] Delete account: test only on throwaway user — `DELETE /api/v1/settings/account`
- [ ] **Inbox:** Settings → Inbox and Profile mail icon open [`MailInboxScreen`](../alter-ego-mobile/src/screens/MailInboxScreen.tsx) — `GET /api/v1/mail`, open marks read, **Mark all read** uses `POST /api/v1/mail/read-all`; hero + “How your inbox works” explains product to beta testers

## 11) Scheduler / server jobs

- [ ] Hosted jobs (Render etc.): mission generation, twin, reports — logs/alerts on failure

## 12) Minimum QA matrix

- [ ] New Google user: full path
- [ ] Sign in later: full path
- [ ] Returning user: cold start + token refresh
- [ ] Day rollover (timezone): new missions
- [ ] Airplane mode / slow network on mission complete

---

After this list: security review, responsive layouts on multiple devices, then beta distribution.
