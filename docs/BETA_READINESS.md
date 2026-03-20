# Closed beta — operator readiness (ALTER EGO)

Use this with [`CLOSED_BETA_E2E_CHECKLIST.md`](./CLOSED_BETA_E2E_CHECKLIST.md) before inviting testers.

## 1. Mobile build (`alter-ego-mobile`)

| Item | Action |
|------|--------|
| API URL | Set `EXPO_PUBLIC_API_URL` to your **HTTPS** staging/beta backend (never `localhost` for TestFlight / physical devices unless tunneled). |
| Supabase | `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` must match the project your backend uses. |
| Closed beta flag | Set `EXPO_PUBLIC_CLOSED_BETA=true` so Sign-up shows **Google + Sign in later only**, Settings hides **Subscription**, and Paywall shows **Included in closed beta**. |
| Dev client | Use an **EAS development build** or preview build for OAuth + push; Expo Go has limitations. |

See [`.env.example`](../alter-ego-mobile/.env.example) for all variables.

## 2. Backend (`alter-ego-backend`)

- Service role key, OpenAI, and Supabase URL configured on the host (e.g. Render).
- CORS / allowed origins include your app if applicable.
- Jobs: mission generation, twin strip, weekly reports — confirm cron or worker is running and logging errors.

## 3. OAuth (Google)

- Google Cloud OAuth client IDs for **iOS bundle ID** and **Android package + SHA-1**.
- Supabase Auth: Google provider enabled; redirect URLs for dev vs production builds documented.

## 4. Code behaviour (already aligned for beta)

- **No automatic Paywall** navigation that blocks tabs; Paywall is only opened from Settings when not in closed beta.
- **Splash** (~2.5s): session → `create-profile` + `GET /api/v1/auth/me` → Main vs Onboarding; **one automatic retry** on non-auth failures for weak networks.
- **Home** missions errors use **`getErrorMessage`** + Retry.
- **Paywall** (non–closed-beta): Subscribe / Restore show **Alert** (“coming soon” / restore) instead of silent logs.
- **Rank card — Regenerate oracle** refetches Twin strip (no placeholder line).
- **Inbox**: Settings + Profile; mark read / mark all read wired to API.
- **`App.tsx`**: push/timezone registration does not pass invalid args into `onAuthStateChange` handlers.

## 5. Smoke test before sharing (15 min)

1. Cold install → Splash → Sign in later or Google → onboarding or Main.  
2. Kill app mid-onboarding → reopen → resume.  
3. Home → missions load or error + Retry.  
4. Settings → Inbox, Contact, Log out.  
5. Airplane mode on Home → error message readable → Retry after network back.

## 6. Distribution

- **iOS**: TestFlight internal + external testers as appropriate.  
- **Android**: Internal testing track or closed testing.  
- Share **privacy policy** and **support channel** (e.g. Contact Us in app) with testers.

After smoke tests: run through every row of `CLOSED_BETA_E2E_CHECKLIST.md` on a real device against the same API URL you ship in the build.
