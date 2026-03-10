# Phase F — Scale-ready checklist

Use this when preparing for launch (100k target). Each item is integration work; codebase is ready for wiring.

---

## 1. Analytics (PostHog or equivalent)

- [ ] Add PostHog SDK to `alter-ego-mobile` (e.g. `posthog-react-native` or Expo-compatible).
- [ ] Set `POSTHOG_API_KEY` and host in env.
- [ ] Capture events:
  - `sign_up` — after successful auth.
  - `onboarding_complete` — after Twin intro "Begin" (user enters Main).
  - `mission_complete` — each time a mission is completed (optional: with mission_type).
  - `twin_chat_open` — when user opens Twin Chat.
  - `paywall_view` — when PaywallScreen is shown.
  - `subscribe` — after successful RevenueCat purchase.
- [ ] Optional: identify user by stable id after sign-up.

---

## 2. ASO (App Store / Play Store)

- [ ] **Title / short title:** Include "Your rival is you" or "ALTER EGO" clearly.
- [ ] **Subtitle (iOS):** e.g. "We learn you in 14 days. Your only job: show up."
- [ ] **Short description (Android):** Same factor lines.
- [ ] **Long description:** Lead with the factor; then features (Twin, missions, 14-day adaptation).
- [ ] **Keywords:** discipline, habits, show up, rival, twin, consistency, 14-day trial.
- [ ] Update `app.json` / `app.config.js` (Expo) `name`, `description`, and store-specific fields when publishing.

---

## 3. Rating prompt

- [ ] Choose random day in 4–12 from `trial_start_date` (e.g. store in user or compute once).
- [ ] When that day is reached and user has not been prompted, show in-app rating (Expo: `expo-store-review` or similar).
- [ ] After show (or dismiss), call backend to set `users.rating_prompted_at = now()` so we never prompt again.
- [ ] Backend: PATCH /user/me with `rating_prompted_at` or add a dedicated endpoint.

---

## 4. RevenueCat

- [ ] Create product in App Store Connect / Google Play: `alter_ego_monthly`, 14-day free trial, $9/month.
- [ ] Add RevenueCat SDK to `alter-ego-mobile` (see RevenueCat docs for Expo/React Native).
- [ ] Configure 14-day trial and entitlement (e.g. `premium`).
- [ ] On app load (or after auth), check entitlement; if not entitled and trial ended, show PaywallScreen (already in place).
- [ ] After purchase, update backend `subscription_status` via webhook or client so GET /user/me reflects status.
- [ ] Product ID in CLAUDE.md: `alter_ego_monthly`.

---

## 5. Backend env for production

- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET` set.
- [ ] `OPENAI_API_KEY` set for Twin (and other agents).
- [ ] Optional: `POSTHOG_API_KEY` for server-side events.
- [ ] CORS: restrict origins to your app domain(s) when going live.

---

*Once these are done, the app is scale-ready for launch. Update BUILD_PROCESS.md when you complete each.*
