# ALTER EGO — CLAUDE.md
# Cursor reads this file automatically every session.
# Never ask me to re-explain the project. Everything is here.
# v2.2 — Updated March 2026 (synced to repo)

---

## 1. PROJECT IDENTITY

- **App name:** ALTER EGO: The Adaptive Discipline Engine
- **Type:** Mobile app (iOS + Android)
- **Tagline (external):** "Your rival is you — one week ahead."
- **Tagline (subtitle / optional):** "We learn you in 14 days. Your only job: show up."
- **Core mechanic:** Shadow Twin — an AI rival always exactly one week of consistent behaviour ahead
- **Primary emotion:** Pride. Never guilt.
- **Target user:** 18–28. Pain point: "I know what I need to do, I just can't make myself do it consistently."
- **Revenue:** Paid subscription after trial; no credit card at signup (product). **Trial length in code:** `FREE_TRIAL_DAYS` in `constants.py` (currently 7) — see §9 Monetisation.

### 1.1 Theme & Factor (source of truth for copy and positioning)

**Theme — middle ground between "showing up is what matters" and "goal-oriented":**
- The app starts process-first and adapts toward goal-oriented based on user behaviour over 14 days.
- **Acquisition / first touch:** Outcome language ("Build the life you want," "Your rival is you — one week ahead"). Do not lead with philosophy at the door.
- **Onboarding framing screen:** "We don't count perfect days. We count the ones you showed up." — this sets the philosophy before any question is asked.
- **Days 1–14 (showing up phase):** Copy emphasizes "Show up," "You showed up," "Start anywhere." Difficulty is forgiving. Missions are achievable. The app rewards presence, not perfection.
- **Day 14+ (adaptive phase):** After 14 days of behavioural data, the system shifts toward the user's demonstrated pattern. High-completion users receive harder missions and more competitive Twin framing. Low-completion users stay process-first. This shift is silent — the app never announces it.
- **Home screen first copy:** When 0 missions completed today, header reads "Start anywhere." After first mission, it switches to "Today's Missions." One phrase that embodies the philosophy.

**14-day adaptation:**
- First 14 days = free trial + when we learn how the user works. Framing: "Your first 14 days we learn how you work best. Your only job: show up every day. We'll adapt the app to you."
- We learn: archetype, interests, hours, quit targets (onboarding); completion rate, mission preference, difficulty tolerance, activity time, Twin engagement (behaviour).
- We adapt: Twin tone, Planner (count/difficulty), nudge timing, optional copy framing (goal vs process).
- Transparency: "We use how you use the app to personalize your experience. We don't sell your data." Optional at day 14: "What we learned about you."

**The factor (deciding factor for users):**
- **Primary hook:** "Your rival isn't an app. It's you — one week ahead." Use for store listing, splash, word-of-mouth.
- **Secondary hook:** "We learn you in 14 days. Your only job: show up."
- **In-app north star:** Every key copy supports (a) "you're racing your Twin" or (b) "you showed up / your job is to show up." No guilt; pride only. Twin = embodiment of "you one week ahead."

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Mobile frontend | React Native + Expo (iOS + Android) |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| State (mobile) | Zustand (auth store, user store) |
| Data fetching (mobile) | TanStack React Query + base API client (src/services/api.ts) |
| Backend | FastAPI (Python 3.11.9) — Render free tier |
| Database | Supabase (PostgreSQL) — Auth, Storage, Realtime |
| Authentication | Supabase Auth — Google OAuth + Apple + Email |
| AI / LLM | GPT-4o-mini via LangGraph-style agent modules (Twin chat, reports, nudges, planners, etc.) |
| Agent memory | Supabase pgvector (Twin chat) |
| Background jobs | APScheduler (`app/core/scheduler.py`) — hourly tick, per-user local timezone windows |
| Analytics | PostHog free tier |
| Character animation | Pika Labs (MP4 clips from Midjourney art) — per-state loops |
| Pet animation | Pika Labs (MP4 clips) — 6 states: idle/walk/happy/sad/react/sleep |
| Hero crossfades | Runway Gen-4 (evolution + pet evolution + 365-day streak cinematic) |
| In-app video playback | expo-av / expo-video — looping MP4s |
| UI animations | React Native Reanimated 3 — all overlays, transitions, particles |
| In-app purchases | RevenueCat |
| Push notifications | Expo Push Notifications |
| Version control | GitHub — single repo 'alter-ego' |
| Code editor | Cursor IDE |

> **No Rive.** All character and pet animations are AI-generated MP4 clips. Rive was replaced in v2.0.

---

## 3. FOLDER STRUCTURE

```
alter-ego/
├── alter-ego-mobile/
│   ├── App.tsx
│   ├── global.css
│   ├── metro.config.js
│   ├── tailwind.config.js
│   ├── babel.config.js
│   ├── global.d.ts
│   ├── src/
│   │   ├── services/         # api.ts, auth.ts, missions.ts, profile.ts, quits.ts, …
│   │   ├── store/            # authStore.ts, userStore.ts (Zustand)
│   │   ├── providers/        # AppProviders.tsx (React Query + auth init)
│   │   ├── utils/            # supabase.ts, onboarding helpers, etc.
│   │   ├── screens/
│   │   ├── components/       # includes profile/, onboarding/, …
│   │   ├── hooks/            # useMissions, useTwin, useQuits, useInterests, …
│   │   ├── navigation/       # RootStack, MainStack, MainTabNavigator, ProfileStack, OnboardingStack, types.ts
│   │   ├── constants/       # theme.ts, characterProgression.ts (must match backend XP_THRESHOLDS)
│   │   ├── context/          # OnboardingAnswersContext, …
│   │   └── types/
│   └── assets/
│       ├── images/
│       │   ├── characters/   # character_1_male.png … character_6_female.png
│       │   └── pets/         # pet_1_cub.png … pet_8_dragon.png (source art only)
│       └── video/
│           ├── characters/   # character_1_male_idle.mp4 … character_6_female_idle.mp4
│           ├── pets/         # pet_1_cub_idle.mp4, pet_1_cub_walk.mp4 … pet_8_dragon_sleep.mp4
│           └── hero/         # evolution crossfades, pet evolution, 365-day cinematic
├── alter-ego-backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── migrations/           # 001 … 020 (see folder; sigil, quit_paths, discipline_dna pillars, twin_mission_log, …)
│   └── app/
│       ├── api/              # auth, missions, twin, leaderboard, reports, mail, profile, settings, stats, quits, sigil, onboarding
│       ├── core/             # constants, supabase_client, scheduler, journal_rules, subscription, archetype, …
│       ├── services/         # mission, streak, twin, quit, sigil, stat, interest_path, power_score, mail, onboarding, report, …
│       └── agents/           # core_mission_agent, interest_planner_agent, personal_mission_agent, quit_* agents, nudge, twin_chat, report, interest_normaliser, …
└── CLAUDE.md                 ← this file
```

---

## 4. NATIVEWIND V4 — CRITICAL CONFIG NOTES

**NativeWind v4 is installed. Do NOT follow v3 tutorials. Key rules:**

- `global.css` — contains `@tailwind base/components/utilities`
- `metro.config.js` — uses `withNativeWind` wrapper pointing to `global.css`
- `tailwind.config.js` — includes `nativewind/preset` and correct content paths
- `babel.config.js` — does **NOT** include `nativewind/babel` plugin (v4 does not need it)
- `global.d.ts` — contains `/// <reference types="nativewind/types" />`
- `App.tsx` — imports `global.css` as the very first line
- Always run `npx expo start --clear` after any config changes
- Gradients cannot use className — use `expo-linear-gradient` component with inline style
- `className` works correctly for all solid colour and spacing utilities

### 4.1 Frontend wiring layer (W1)

All services and screens should use the shared API client and stores. Do not call Supabase auth or raw fetch from screens.

- **Base API client** — `src/services/api.ts`
  - `apiClient.get/post/put/patch/delete(path)` — auth header from `@/utils/supabase` session, retry (3×, exponential backoff), 401 → refresh session and retry once.
  - Errors: `ApiError`, `NetworkError`, `AuthError`; helpers: `isApiError`, `isAuthError`, `isNetworkError`, `getErrorMessage`.
  - Base URL: `EXPO_PUBLIC_API_URL` (default `http://localhost:8000`).
- **Auth store** — `src/store/authStore.ts` (Zustand)
  - State: `session`, `user`, `isLoading`, `isAuthenticated`, `isAnonymous`.
  - Actions: `initialize()` (on app startup), `setSession`, `signInAnonymously`, `signInWithGoogle` (delegates to `@/services/auth`), `signOut`, `refreshSession`.
  - Screens read auth from this store; do not call `supabase.auth` directly from screens.
- **User store** — `src/store/userStore.ts` (Zustand)
  - `UserProfile` type matches `/api/v1/profile/overview`. State: `profile`, `isLoading`, `error`.
  - Includes optional Twin voice hints from server: `twin_tone_type`, `twin_intensity`; optional `profile_photo_url`.
  - `fetchProfile()` — called when user becomes authenticated (from AppProviders).
  - Optimistic updates: `updateXP`, `updatePF`, `updateStreak`, `updatePowerScore`, `updateStage`, `updatePetStage`, `incrementUnreadMail`, `clearProfile`.
  - Character XP bar math must match backend: use `src/constants/characterProgression.ts` (`CHARACTER_XP_THRESHOLDS` aligned with `app/core/constants.py` `XP_THRESHOLDS`).
- **AppProviders** — `src/providers/AppProviders.tsx`
  - Wraps app with `QueryClientProvider` (staleTime 5m, gcTime 10m, retry 2, no refetchOnWindowFocus).
  - On mount: `useAuthStore.initialize()`. When `isAuthenticated`: `useUserStore.fetchProfile()`.
  - App.tsx root must wrap content with `<AppProviders>`.
- **Path alias** — `@/` → `src/`
  - `tsconfig.json`: `"baseUrl": "."`, `"paths": { "@/*": ["src/*"] }`.
  - `babel.config.js`: `module-resolver` with `root: ["./src"]`, `alias: { "@": "./src" }`. Reanimated plugin must remain last.

---

## 5. DESIGN TOKENS — USE THESE EXACT VALUES ALWAYS

### 5.1 Colour Tokens

```typescript
// src/constants/theme.ts — EXACT VALUES, no approximations
export const COLORS = {
  // Backgrounds
  bg0:          '#07080F',   // deepest background (gradient end)
  bg1:          '#0D0F1A',   // primary background (gradient start)
  surface:      '#141824',   // cards, panels, chat bubbles
  surface2:     '#1E2333',   // XP bar background, elevated surfaces
  border:       '#2A3050',   // glass panel borders

  // Violet — primary accent family
  violet:       '#8B5CF6',   // buttons, XP bar, active states, selected options
  violetDeep:   '#6D28D9',   // progress bars, active nav icon, gradient start
  violetGlow:   '#A78BFA',   // particles, glows — NEVER as flat fill
  violetLine:   '#C084FC',   // Twin fracture line ONLY — 2px width

  // Single warm accent
  ember:        '#F97316',   // streak flame ONLY — nowhere else
  emberGlow:    '#FB923C',   // streak flame glow only

  // Gold — 365-day streak ONLY
  gold:         '#F59E0B',   // 365-day particle burst ONLY — the single gold element in the entire app

  // Text
  text:         '#E5E7EB',   // headings, primary text — NOT pure white
  text2:        '#9CA3AF',   // secondary text, descriptions
  muted:        '#6B7280',   // timestamps, metadata, subtext

  // States
  danger:       '#7F1D1D',   // error, pet warning, Core mission left edge — NEVER bright red
  core:         '#7F1D1D',   // alias of danger — Core mission card left edge ONLY
  success:      '#8B5CF6',   // success = violet glow, NEVER green

  // Glass surfaces
  glass:        'rgba(20,24,36,0.75)',   // top bar, Twin strip, panels
  glassBlur:    10,                       // backdropFilter blur value (px)
  glassBorder:  '#2A3050',               // 1px border on glass elements
};
```

**Tailwind config custom colours (already in tailwind.config.js):**
```js
ae: {
  bg0: '#07080F', bg1: '#0D0F1A', surface: '#141824', surface2: '#1E2333',
  border: '#2A3050', violet: '#8B5CF6', violetDeep: '#6D28D9',
  violetGlow: '#A78BFA', violetLine: '#C084FC', ember: '#F97316',
  emberGlow: '#FB923C', gold: '#F59E0B', text: '#E5E7EB', text2: '#9CA3AF',
  muted: '#6B7280', danger: '#7F1D1D', core: '#7F1D1D',
}
```

**Colour rules — never break these:**
- No green anywhere in the app. Success state = violet glow.
- Orange (#F97316) appears ONLY on streak flame icon. Nowhere else.
- Gold (#F59E0B) appears ONLY in the 365-day streak cinematic particle burst and year badge. Nowhere else.
- No pure white (#FFFFFF) for text. Use #E5E7EB.
- No pure black (#000000) for backgrounds. Use #07080F or #0D0F1A.
- Danger state = deep crimson #7F1D1D. Never bright red.

### 5.2 Typography — Inter Only

```typescript
export const FONTS = {
  // All text uses Inter. Single font throughout.
  // Cinematic feel achieved through weight + tracking, not font switching.

  display:  { size: 32, weight: '700', tracking: -0.5 },  // splash, evolution title
  h1:       { size: 28, weight: '700', tracking: -0.5 },  // archetype name, large titles
  h2:       { size: 24, weight: '700', tracking: -0.3 },  // screen titles
  h3:       { size: 18, weight: '600', tracking: -0.2 },  // section titles
  body:     { size: 16, weight: '400', tracking: 0 },     // body text
  bodyMd:   { size: 15, weight: '400', tracking: 0 },     // mission titles, chat bubbles
  bodySm:   { size: 14, weight: '400', tracking: 0 },     // descriptions, sub-labels
  label:    { size: 12, weight: '500', tracking: 0.3 },   // UI labels, chips
  micro:    { size: 11, weight: '500', tracking: 0.4 },   // timestamps, legal, per-mission streak
  stat:     { weight: '700' },                             // XP, Power Score, streak — always 700
};
```

### 5.3 Spacing — 8pt Grid

```typescript
export const SPACING = {
  xs:   4,    // tiny gaps
  sm:   8,    // small gaps
  md:   16,   // standard padding, card padding, screen padding
  lg:   24,   // section spacing
  xl:   32,
  xxl:  40,
  xxxl: 48,

  // Special values
  screenPadding:    16,   // horizontal padding on all screens
  cardGap:          12,   // gap between cards in a list
  sectionGap:       24,   // gap between sections on a screen
  cardPadding:      16,   // internal padding inside cards
  heroToSection:    24,   // hero zone to next section
  contentPaddingBottom: 96,  // bottom of scrollable content (clears nav bar)
};
```

### 5.4 Border Radius

```typescript
export const RADIUS = {
  chip:   10,   // small chips, tags, difficulty badges, level badges
  card:   16,   // mission cards, buttons, modals
  modal:  24,   // large modals, bottom sheets, report card
  full:   9999, // circles, pills
};
```

### 5.5 Shadows

```typescript
export const SHADOWS = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  violet: {
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  violetGlow: {
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  fracture: {
    shadowColor: '#C084FC',
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  button: {
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
};
```

### 5.6 Gradients (use expo-linear-gradient)

```typescript
export const GRADIENTS = {
  background:   { colors: ['#0D0F1A', '#07080F'], start: {x:0,y:0}, end: {x:0,y:1} },
  button:       { colors: ['#6D28D9', '#8B5CF6'], start: {x:0,y:0}, end: {x:1,y:0} },
  xpBar:        { colors: ['#6D28D9', '#A78BFA'], start: {x:0,y:0}, end: {x:1,y:0} },
  evolution:    { colors: ['#1E1B4B', '#0F0C29'], start: {x:0,y:0}, end: {x:0,y:1} },
  fractureLine: { colors: ['transparent', '#C084FC', 'transparent'], start:{x:0,y:0}, end:{x:0,y:1} },
  rankCard:     { colors: ['#1E1B4B', '#0D0F1A'], start: {x:0,y:0}, end: {x:0,y:1} },
};
```

### 5.7 Heatmap Colour Levels

```typescript
export const HEATMAP_LEVELS = ['#111827', '#312E81', '#4C1D95', '#6D28D9', '#A78BFA'];
// Level 0 = no activity, Level 4 = full completion
// Cell size: 14×14px (Profile Streak tab ONLY — heatmap removed from Home screen in v1.1)
// Cell gap: 3px, Cell radius: 3px
```

---

## 6. ANIMATION SYSTEM — v2.0

**NO RIVE. All character and pet animations are AI-generated MP4 clips played via expo-av.**
**All UI animations (overlays, transitions, particles, number ticks) use Reanimated 3.**

```typescript
export const ANIMATIONS = {
  // Durations (ms)
  tap:            80,     // press feedback
  cardAppear:     200,    // list items appearing
  transition:     150,    // tab switches (N1)
  screenEntry:    200,    // screen push (N2)
  modal:          200,    // modal open/close (N3)
  reportEntry:    300,    // Report tab entry (N4 — slower, deliberate)
  missionSwipe:   200,    // card exit right after 60% threshold
  missionCollapse:200,    // card height collapse to 0
  xpFloat:        800,    // XP+PF float animation total duration
  xpFill:         260,    // XP bar fill easeOut
  twinPulse:      600,    // Twin strip new message glow (2 pulses × 300ms)
  powerScoreTick: 40,     // ms per digit in slot-machine Power Score update
  evolution:      3900,   // full H1 character evolution cinematic (total)
  petUnlock:      3800,   // H2 Cub arrival cinematic
  petEvolution:   2500,   // H3 pet evolution crossfade
  streakCardHold: 2000,   // Tier B/C streak milestone hold duration
  heatmapFill:    300,    // M6 radial fill per cell

  // Easing
  standard:    'easeOut',    // most UI interactions
  cinematic:   'easeInOut',  // evolution, big reveals
  spring:      { damping: 15, stiffness: 200 },  // badge bounce, card spring-back

  // Press animation — apply to ALL buttons and tappable cards
  pressScale:  0.97,
  pressIn:     80,
  pressOut:    120,

  // Card appear stagger
  staggerDelay: 60,
  staggerMax:   300,

  // Glow pulse (Twin alert strip)
  glowMin:     0.2,
  glowMax:     0.7,
  glowRepeats: 3,
};
```

### 6.1 The 35 Animations — Tier Summary

| Tier | Count | Category | Implementation |
|---|---|---|---|
| 1 | 6 | Hero (H1–H6) | Reanimated + Runway MP4 crossfades |
| 2 | 7 | Home living (L1–L7) | expo-av MP4 clips + Reanimated overlays |
| 3 | 6 | Mission completion (M1–M6) | Reanimated gestures + expo-av clip switch |
| 4 | 4 | Navigation (N1–N4) | Reanimated via React Navigation screenOptions |
| 5 | 8 | Micro (F1–F8) | Reanimated |
| 6 | 3 | Onboarding (O1–O3) | Reanimated |

### 6.2 Hero Animation Quick Reference (Tier 1)

| ID | Name | Trigger | Key detail |
|---|---|---|---|
| H1 | Character Evolution | XP threshold crossed | 7-phase, unskippable, 3900ms total |
| H2 | Pet Unlock (Cub) | Day 6 since registration (`PET_UNLOCK_DAY`) | Soft overlay, particles converge, Cub fades in |
| H3 | Pet Evolution | Pet stage threshold | White flash + Runway crossfade |
| H4 | Streak Milestone | 3/7/14/30/60/100/180/365 day streaks | 3 intensity tiers. 365 = ONLY gold in app |
| H5 | Twin Chat Unlock | Stage 2 reached | Strip expands, "SPEAK WITH YOUR TWIN" |
| H6 | Leaderboard Unlock | 3-day streak (`LEADERBOARD_UNLOCK_STREAK`) | Tab pulse + banner drop |

### 6.3 Pet Roaming System

The pet roams freely across the entire Home screen. Not confined to a zone. Meow-style.

```typescript
// Pet clip states — 6 per pet stage (48 total clips)
// State priority: sad > sleep > happy > idle/walk
type PetClipState = 'idle' | 'walk' | 'happy' | 'sad' | 'react' | 'sleep';

// Roaming state machine
type RoamState = 'IDLE' | 'MOVING' | 'REACTING' | 'RETURNING' | 'SLEEPING';

// Movement rules
const ROAM = {
  idleDuration:   [8000, 15000],  // ms, random range
  moveDuration:   [2000, 4000],   // ms, derived from distance/speed
  pauseDuration:  [3000, 8000],   // ms at destination
  speedPxPerSec:  [60, 120],
  hitSlop:        20,             // px on all sides for touch target
  navExclusion:   80,             // px from bottom — pet never enters this zone
  edgeExclusion:  40,             // px from screen edges
};

// sleep triggers: local_time > 23:00 OR consecutive_missed_core_days >= 3
// sad state: reduces movement speed by 50%, clip overrides to sad.mp4
// react: on tap → 1500ms one-shot → RETURNING → hero zone → resume roam
```

---

## 7. NAVIGATION STRUCTURE

**Source files:** `src/navigation/RootStack.tsx` (root), `OnboardingStack.tsx`, `MainStack.tsx`, `MainTabNavigator.tsx`, `ProfileStack.tsx`, `types.ts` (`*ParamList` types).

```
RootStack (Stack)
├── Splash
├── SignUp
├── Onboarding   → OnboardingStack (wrapped in OnboardingAnswersProvider)
└── Main         → MainStack

OnboardingStack
├── OnboardingFraming
├── OnboardingQuestion        # multi-step flow (many question keys; see OnboardingQuestionScreen)
├── ArchetypeReveal
├── Onboarding7Day
├── TwinIntroduction
└── NotificationPermission

MainStack (Stack; BottomSheetModalProvider at root)
├── MainTabs                  → MainTabNavigator (bottom tabs + CustomTabBar)
├── SigilScreen
├── Paywall
├── Settings, SettingsProfile, AccountSettings, ContactUs, SettingsFaq
├── MailInbox, ToneHistory
├── TwinChat
├── RankCard, ShareableCardsPreview
├── PastReportDetail, DayDetail
├── JournalList, JournalEditor, JournalCalendar
└── MissionDetail

MainTabNavigator
├── Home
├── Leaderboard
├── Twin          (TwinComparisonScreen — center raised tab)
├── Report        (WeeklyReportScreen)
└── Profile       → ProfileStack

ProfileStack
├── ProfileMain
├── ProfileAbilities
├── ProfileStreak
├── ProfileInterests
├── ProfileIdentity
├── ProfileCompanion
└── ProfileQuits
```

Overlays / modals used inside screens (evolution, pet unlock, milestones, etc.) are not all separate stack routes — implement as components where the codebase attaches them.

**React Navigation theme — REQUIRED:**
```javascript
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0D0F1A', card: '#0D0F1A' },
};
<NavigationContainer theme={navTheme}>
```

Every screen must use LinearGradient as its ROOT element:
- Correct: `<LinearGradient colors={['#0D0F1A','#07080F']} style={{flex:1}}>`
- Wrong: `<View style={{flex:1}}><LinearGradient ...>`

**Tab bar specifics:**
- 5 tabs. Tab 3 (Twin) is a raised circular button.
- Active: icon + label #8B5CF6. Inactive: #6B7280.
- Active glow shadow: rgba(139,92,246,0.5)
- Height: 56px + safe area bottom. Background: rgba(10,12,20,0.95), blur 12px, border top 1px #2A3050.
- Sunday: Report tab (Tab 4) has a persistent 6px violet dot until weekly report is opened.

---

## 8. COMPONENT REFERENCE

All components live in `src/components/`. Props interfaces must stay stable.

| Component | Key props | Notes |
|---|---|---|
| PrimaryButton | label, onPress, disabled, loading, icon | F1 press animation always applied |
| OnboardingOptionCard | label, selected, onSelect | |
| MissionCard | title, category, difficulty, xpValue, petFoodValue, status, onComplete, missionType, missionStreak | missionStreak: 🔥N for Core + Interest (+ Resistance if wired); not Personal. Today list can include `twin_completed` / `twin_completed_at_hour` from `twin_mission_log`. |
| LeaderboardRowCard | rank, username, stageTitle, characterStage, petStage, streak, powerScore, isOwnRow | petStage icon visible in row |
| TypeChip | type ('core'\|'interest'\|'resistance'\|'personal'\|'recovery') | `resistance` = quit-path / escaper missions from `quit_paths` |
| DifficultyChip | level ('Easy'\|'Medium'\|'Hard') | |
| TextInput | value, onChange, placeholder, maxLength | |
| Slider | value, onChange, min, max, step | |
| XPProgressBar | currentXP, nextStageXP, nextStageName | Also used for per-interest progress (thin 4px variant) |
| SectionProgressRing | completed, total, color | 32px ring beside Home section headers |
| BottomNavBar | activeTab, onTabPress | |
| TopBar | username, stageTitle, powerScore | Power Score ticks on update (L7) |
| BottomSheet | visible, onClose, children | |
| TwinAlertStrip | message, hasNewMessage, onPress, twinThumbnailUri | v1.1: 40px character thumbnail left |
| StreakHeatmap | data (365 day array) | Profile Streak tab only. 14×14px cells. |
| OnboardingProgressBar | questionNumber | 3px bar; onboarding has many steps (not limited to 10) |
| SkeletonLoader | width, height, radius | |
| EmptyState | type, message | |
| PetAnimation | stage (1-8), petState, size, roaming | petState: 'idle'\|'walk'\|'happy'\|'sad'\|'react'\|'sleep'. roaming=true on Home only. |
| DayOfWeekChart | data ({mon,tue,wed,thu,fri,sat,sun}: 0–1) | Report screen only |
| InterestLevelBadge | level (1-10), isGolden | Golden ring at L10 |
| TwinLevelBadge | level (1-10) | Beside user level in Interests tab. Always 1 ahead. |

---

## 9. PRODUCT DECISIONS & SYSTEM RULES

**Numeric truth:** `alter-ego-backend/app/core/constants.py` + mobile `src/constants/characterProgression.ts` (XP). This section mixes locked product intent with **current** backend behaviour — if they diverge, fix code or copy deliberately.

### Character System
- **6 stages:** The Awakened → The Focused → The Burning → The Relentless → The Formidable → The Sovereign
- **XP thresholds (exact — `app/core/constants.py` `XP_THRESHOLDS`, mirrored in mobile `src/constants/characterProgression.ts`):** cumulative total XP to *reach* each stage: **0 / 800 / 9,800 / 36,800 / 108,800 / 375,200**
- Art: dark cinematic realism, God of War / Hades / Black Myth aesthetic
- 2 genders selectable in onboarding. 12 illustrations total (6 stages × 2 genders).
- 12 idle clips (Pika MP4, 4s loop each). Intensity scales S1 (barely moves) → S6 (constant energy aura).
- Evolution: unskippable H1 cinematic, 7 phases, 3900ms total.

### Pet System
- **8 stages:** Cub → Cat → Fox → Wolf → Snow Leopard → Panther → Griffin → Dragon
- **Pet Food thresholds (exact — `PF_THRESHOLDS` in `constants.py`):** Cub unlock **0** / Cat **400** / Fox **2,800** / Wolf **10,000** / Snow Leopard **26,800** / Panther **62,000** / Griffin **113,200** / Dragon **242,800**
- **Pet unlock:** `PET_UNLOCK_DAY = 6` — day **6** since `registration_date` (user timezone), via `pet_unlock_check_job` in scheduler; not tied to streak length.
- Before unlock: treat as no pet in UI (`pet_unlocked` / stage 0).
- **6 clip states per pet:** idle / walk / happy / sad / react / sleep (48 total MP4 clips, Pika-generated)
- Pet roams freely across Home screen (Section 6.3 above). Not confined to hero zone.
- **State priority:** sad > sleep > happy > idle/walk
- Regression: Days 1–29 frozen + pet sad + full recovery possible. Day 30+: dynamic penalty.

### Shadow Twin System
- Twin starts at exact same point as user on Day 1. The gap is created entirely by the user's behaviour.
- Twin simulates near-perfect consistency. **4 gap states:** AHEAD / CLOSING / MATCHED / PASSED (user overtook Twin = most memorable moment).
- **3 tone types:** RIVAL (competitive, direct) / PHILOSOPHER (reflective, wistful) / SILENT FORCE (minimal, factual).
- **`discipline_dna` table** (per `user_id`): Twin voice, gap behaviour, **per-pillar core difficulties** (`core_*_difficulty`, clean-week counters), telemetry. Onboarding upserts a row; missions and jobs read/update it.
- **Jobs:** `twin_recalibration_job` — first run **day 7**, then **every 7 days** (`twin_service.recalibrate_twin`). **Core pillar** auto difficulty changes use a **14-day** evidence window (`MIN_DAYS_BETWEEN_AUTO_CORE_CHANGES` in `mission_service`).
- Twin strip messages are rule-based (no LLM cost). LLM only invoked when user opens Twin Chat.
- **Twin simulation (`twin_service.simulate_twin_day`):** archetype rhythm profiles (`ARCHETYPE_RHYTHMS`), daily completion simulation, **`twin_mission_log`** writes for Home parity. **Crossing recovery:** when user passes Twin, **phase 1** ~**6 days** (`CROSSING_RECOVERY_DAYS`) with boosted twin rate (`CROSSING_RECOVERY_BOOST`); **phase 2** after **14** days ahead (`DORMANT_GAP_TRIGGER_DAYS`) twin tracks user average + small offset (`DORMANT_GAP_OFFSET`) — see `twin_service.py` for exact logic.
- **Twin Chat API:** `POST /chat`, `GET /chat/history`, **`POST /chat/{message_id}/rate`** (quality signal); tone feedback: **`POST /tone-rating`**, **`GET /tone-history`** (`015` migration era).
- Twin Chat scope: discipline, motivation, growth, reflection ONLY. "That won't make you stronger." for off-topic.
- **Twin Chat unlocks at Stage 2 (The Focused).** Not available Day 1.

### Mission System — code alignment
- **Mission `type` values in API/lists:** `core`, `interest`, `resistance`, `personal` (grouped on GET today). `recovery` may still exist for legacy/special flows — see `MISSION_PF` / ordering in `mission_service`.
- **Core:** five pillars (sleep, movement, hydration, mindfulness, no_phone) **plus a separate Daily Journal core mission** (`is_journal_mission`). Journal completion requires a saved `journal_entries` row for that `mission_date` (`journal_rules.py`). Core set size can vary (e.g. 3–5 pillars + journal) from `generate_core_missions_for_user` / `core_mission_agent`.
- **Interest:** rows in `interests` table; missions keyed by `interest_id`. Generated/synced by `interest_planner_agent`; `GET /missions/today` calls `sync_today_planner_missions` so mid-day profile changes apply.
- **Resistance:** quit / escaper missions tied to **`quit_paths`** (`quit_path_id` on mission). Synced in `sync_today_planner_missions` via `quit_service`. Same XP/PF curve as interest in `MISSION_XP_BY_TYPE` / `MISSION_PF`.
- **Personal:** user-created; tier estimated by `personal_mission_agent` (`PERSONAL_MISSION_XP_BY_TIER` + `MISSION_PF["personal"]`).
- **Difficulty:** pillars use easy/medium/hard/**elite** (`discipline_dna` per-pillar fields). Recalibration / clean-week logic in `mission_service.recalibrate_core_pillar_difficulties` and scheduler `twin_recalibration_job`.
- **XP (system missions):** Core 15/25/40/**60** (elite); Interest & Resistance 10/20/30/**40**; Personal tiers 8/15/22 — see `MISSION_XP_BY_TYPE` and `PERSONAL_MISSION_XP_BY_TIER`.
- **PF:** `MISSION_PF` in `constants.py` (includes elite rows).
- **Daily caps (`DAILY_XP_CAPS` / `DAILY_PF_CAPS` by character stage 1–6):** XP **100 / 150 / 200 / 280 / 380 / 500**; PF **160 / 240 / 360 / 480 / 640 / 800**.
- **Streak (progressive tiers — `streak_service.py` + `STREAK_TIER_REQUIREMENTS`):** Resistance missions **do not** count toward the streak requirement. Journal core does **not** count. **tier_1:** 2+ core (non-journal) *or* 1+ interest *or* 3+ combined core+interest. **tier_2** (after character stage ≥ 2): 4 core + 1 interest. **tier_3** (after first 30-day streak): all 5 non-journal core. **tier_4** (after first 60-day streak): 5 core + 1 interest + 1 personal. Tier stored on user as `streak_requirement_tier`.
- **Streak break:** `handle_streak_break` (scheduler, local hour 1) sets `current_streak` **0**, pet sad, optional XP freeze / penalty (`STREAK_FREEZE_DAYS = 29`). Same window runs `pet_unlock_check_job`.
- **Twin vs user missions:** `twin_mission_log` stores simulated completions; `missions` API merges `twin_completed` + `twin_completed_at_hour` by title.
- **Mission rating:** `POST /api/v1/missions/{mission_id}/rate` — feeds difficulty adaptation signals (`DIFFICULTY_*` in `constants.py`) when wired from Mission detail.
- **Mission complete response:** `complete_mission` returns XP/PF, streak block, `power_score`, **`stat_gains`** / **`willpower_progress`** (`stat_service`), **`sigil`** (`sigil_service` aether / surge), stage/pet evolution flags — mobile should handle this shape.
- **Adaptability copy:** Home uses "Start anywhere" when nothing completed today (see `HomeScreen` day-band helpers); switches to "Today's Missions" after first completion.

### Gamification — Power Score + Rank Cards

**Power Score formula:**
```
(XP_stage_% × 0.35) + (pet_stage_norm × 0.20) + (streak_norm_to_30 × 0.25) + (weekly_completion_% × 0.20)
```
- Streak component means a consistent lower-stage user can outrank a higher-stage user who broke their streak.
- Shown in top bar (Power Score) and Leaderboard. Ticks with slot-machine digit animation on update (L7).

**Feature unlock milestones (5 only — everything else Day 1):**
| Trigger | Unlocks |
|---|---|
| Day 1 complete | Character revealed, Twin appears on strip |
| Day 6 since registration | Pet unlocked (`pet_unlocked`, Cub) — scheduler |
| Stage 2 — The Focused | Twin Chat unlocks (product rule) |
| **3-day streak** | **Leaderboard** (`LEADERBOARD_UNLOCK_STREAK` in `constants.py`) + Rank Card access |
| 60-day streak | Weekly Report All-Time section |

**Streak milestone bonuses:**
- 3d: +20XP/+15PF | 7d: +60XP/+50PF | 14d: +120XP/+100PF | 30d: +300XP/+250PF
- 60d: +600XP/+500PF | 100d: +1000XP/+800PF | 180d: +2000XP/+1600PF | 365d: +5000XP/+4000PF + golden year badge

**Rank Cards (unlock at 10-day streak):**
- Portrait 9:16. Background #1E1B4B. Contains: character art, stage title, username, pet icon+name, Power Score (large), streak, last Twin strip message as pull-quote, ALTER EGO wordmark.
- NOT on card: XP numbers, leaderboard rank, completion rates.
- Auto-regenerates on stage change, pet evolution, 365-day streak.
- Year badge (golden ring) at 365-day streak — only gold element on the card.

**Interest progression (Profile → Interests):**
- Interests are rows in **`interests`** with path/phase state (`interest_path_service`, migrations `013`+). UI may show levels, quests, schedules — **exact thresholds** are whatever `/api/v1/profile/...` returns and `interest_path_service` encodes; do not assume the old fixed L1–L10 XP ladder unless you confirm it still matches the API.
- Twin level badge in UI remains **one ahead** of the user’s displayed interest level (product rule).
- L10 golden ring (or top-tier equivalent) remains a rare “mastery” affordance if still in UI.

### Nudge System
- **5 nudge types (priority order):** Streak Warning > Re-engagement > Pet Nudge > Milestone Approaching > Momentum
- **Frequency caps:** Low=1/day (streak warning only) / Medium=2/day / High=3/day
- Hard rules: never if app opened today. Never after 10pm local. Never guilt. One topic per nudge.
- Copy generation: GPT-4o-mini per nudge (`nudge_agent`). Anti-repetition: last 3 nudge texts injected into every call.
- **Delivery:** `nudge_check_job` in **APScheduler** (hourly), not Celery.
- Adaptation: every 7 days, low open rate on type → deprioritise. Consistent opens → upgrade frequency.
- User controls frequency in Settings (Low / Medium / High).

### Weekly Report
- Generated per user local timezone: **Sunday 03:00** in `weekly_report_local_job` (hourly scheduler tick). Replaces previous week's report for that user.
- **5 sections:** This Week (pure data, no LLM) / Your Wins (2–3 specific, never invented) / Where You Slipped (1–2 factual, no blame) / Your Twin This Week (Twin voice) / Next Week (Twin voice, one sentence)
- **All-Time section** unlocks at 60-day streak. Pure data assembly, no extra LLM call.
- **Day-of-week chart** in streak block: Mon–Sun bars showing average completion rate per day. Title: "Your Best Days."
- Anti-repetition: previous 2 weeks' generated content injected into each call. Never same opening word, structure, or core observation.

### Leaderboard
- Power Score ranking (formula above).
- **Unlock:** `leaderboard_unlocked` on user after streak ≥ `LEADERBOARD_UNLOCK_STREAK` (**3** in current `constants.py`). API may also allow `subscription_tier == beta_free` or env-based beta pool — see `leaderboard.py`.
- Global only for MVP. No friends system.
- Each row: username, character thumbnail, pet icon (now prominent — petStage prop), streak, Power Score.
- Top 3: gold/silver/bronze rank number tint.
- User's own row: sticky above nav bar, violet border, F8 pulse on load.

### Monetisation
- **Product intent:** full free trial → paid subscription; no credit card at signup. **Backend trial length** is `FREE_TRIAL_DAYS` in `app/core/constants.py` (currently **7** — used by `app/core/subscription.py`). If marketing copy says 14 days, align constants + paywall with the real SKU policy.
- $9/month after trial. Full features from Day 1 (product).
- Trial banner / paywall: `PaywallScreen` on `MainStack`; wire to RevenueCat as implemented in app.
- RevenueCat. Product ID: `alter_ego_monthly` (verify in RevenueCat dashboard).
- Rating prompt: product choice (e.g. random early week) — implement where wired in mobile.

---

## 10. DATABASE SCHEMA — source of truth

**Authoritative DDL:** `alter-ego-backend/migrations/` (`001` … `020` and beyond). Below is a **conceptual** map of what the running app expects — always verify columns against the latest migration before assuming types.

- **`users`** — identity, `total_xp`, `total_pf`, `character_stage`, `pet_stage`, `pet_unlocked`, streak fields (`current_streak`, `longest_streak`, `last_streak_date`, `streak_requirement_tier`), `power_score`, `timezone`, `leaderboard_unlocked`, subscription/trial fields, `nudge_frequency`, onboarding flags, pet mood (`pet_state`), XP freeze flags, etc.
- **`discipline_dna`** — one row per user: Twin tone, gap behaviour, behavioural telemetry, **per-pillar core difficulty** + clean-week counters (`016`), pending difficulty hints, etc.
- **`missions`** — `type` includes `core`, `interest`, `resistance`, `personal` (and possibly `recovery`); links `interest_id`, `quit_path_id`; `core_pillar`, `is_journal_mission`, `mission_date`, `xp_value` / `pf_value`, completion, rationale/metadata for agents, `stat_tag`, ratings, etc. (see `008`, `004`, …)
- **`interests`** — active interests, scheduling, path/progress JSON (`013` interest path), normalised names for UI.
- **`quit_paths` / quit-path tables** — `014`+ : structured quit journeys; API under `/api/v1/quits`.
- **`journal_entries`** — daily journal text for journal mission gate (`006`).
- **`xp_log` / `pf_log`** — ledger per day with `source_mission_id`, `total_after`, `log_date`.
- **`streak_log`** — daily streak audit row (upsert from `process_streak`).
- **`twin_state` / twin comparison fields** — gap, simulated progress (see twin service + migrations).
- **`twin_chat` / `twin_mission_log`** — chat history (`015`); per-day simulated mission completions for Home comparison (`020`).
- **`weekly_reports`**, **`nudge_log`**, **`app_mails`**, **`milestone_log`**, **`leaderboard_scores`**
- **`character_stats` / stat tables** — SP, abilities (`007`+); served via `/api/v1/stats`.
- **Sigil / aether** — `009`–`012`, `019` rebuild; state read via `/api/v1/sigil`.

RLS: tables are Supabase-backed; policies typically `auth.uid() = user_id` (confirm per migration).

---

## 11. FASTAPI BACKEND STRUCTURE

```text
main.py
  Registers routers (all under /api/v1 unless noted):
  - app.api.auth
  - app.api.onboarding
  - app.api.missions        # today list, complete, personal mission create, pillar difficulty, journal, generate-resistance, …
  - app.api.twin            # state, chat, tone rating, …
  - app.api.leaderboard
  - app.api.reports
  - app.api.mail
  - app.api.profile         # overview, streak, identity, companion, interests + interest-path actions, quits summary, …
  - app.api.settings        # faq, username, notifications, feedback, account delete, …
  - app.api.stats           # GET /stats — character stats / SP (stat_service)
  - app.api.quits           # CRUD-ish quit paths, frequency, advance-phase, schedule (quit_service)
  - app.api.sigil           # GET /sigil — aether / sigil UI state

Startup: APScheduler from app.core.scheduler (daily reset, pet unlock + streak break, twin simulation,
  user_local_maintenance, weekly report, twin recalibration, nudge_check — all hourly with timezone filters).

Core: app.core.constants (ALL numeric product rules), supabase_client, scheduler, journal_rules, subscription, …
Services: mission, streak, twin, quit, sigil, stat, interest_path, power_score, mail, onboarding, report,
  strip_message, progression_service, audit, …
Agents: under app/agents — see §12.

Health: GET /health

**Full route list:** §18 (REST API surface).

Manual audit: cd alter-ego-backend && python -m app.services.audit_service

.env (typical): SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY, POSTHOG_API_KEY,
  feedback/webhook + Resend vars as in previous docs
```

---

## 12. AI AGENTS & GENERATORS

**Model:** GPT-4o-mini (OpenAI) for LLM-backed modules unless a file specifies otherwise.  
**Orchestration:** LangGraph-style graphs where implemented (e.g. Twin chat, report); other agents are plain service modules invoking the API.  
**Memory:** Twin chat uses pgvector-backed history where wired in `twin_chat_agent` / twin service.  
**Scheduling:** Nudges and planners are driven by **APScheduler** jobs + mission reset — not Celery in this repo.

| Module | Role | When it runs |
|---|---|---|
| `core_mission_agent` | Core pillar + journal mission copy / generation | Mission generation / reset path |
| `interest_planner_agent` | Interest mission for a day | `sync_today_planner_missions`, planner hooks |
| `personal_mission_agent` | Tier estimation for personal missions | POST personal mission |
| `quit_mission_agent` / `quit_profile_agent` / `quit_insight_agent` | Quit path missions + profile/insight copy | Quit path sync / quits API |
| `interest_normaliser` | Normalise interest text for storage | Onboarding / interest create |
| `nudge_agent` | Push / mail category C copy | `nudge_check_job` + milestone sends from `complete_mission` |
| `twin_chat_agent` | Shadow Twin chat replies | `POST /twin/chat` |
| `report_agent` | Weekly report sections | `weekly_report_local_job` |

**Profiler / discipline DNA:** Onboarding and `twin_recalibration` + mission recalibration update the **`discipline_dna`** table (and related user fields). There is no single file named `planner_agent.py` in the current tree — planning is split across `mission_service`, `core_mission_agent`, `interest_planner_agent`, and `quit_service`.

**Shadow Twin system prompt structure (v2.0):**
```
You are the Shadow Twin of {username}.
Archetype: {archetype}. Tone type: {tone_type}. Intensity: {intensity}/5.
Gap state: {gap_state}. You are {gap_days} days of consistent behaviour ahead.
Your pet: {twin_pet_name}. Theirs: {user_pet_name}.
Current streak: yours is unbroken. Theirs: {user_streak} days.
Respond ONLY about: discipline, motivation, growth, reflection, the rivalry.
Off-topic: "That won't make you stronger." — exact phrase, every time.
Max 2 sentences per response. Never motivational-poster language.
Previous 3 Twin messages (do not repeat structure or opening): {last_3_messages}
Conversation history: {history}
```

---

## 13. ARCHETYPES — FULL REFERENCE

| Archetype | Behaviour profile | Initial tone_type | Initial intensity | Twin first line (Archetype Reveal screen) |
|---|---|---|---|---|
| The Restless Creator | High novelty, low structure, intensity bursts | RIVAL | 3 | "You finally showed up. I've been here. Let's see if you stay." |
| The Reluctant Achiever | High guilt-sensitivity, perfectionism causing avoidance | PHILOSOPHER | 2 | "You know what to do. You just keep waiting for the right moment. I don't wait." |
| The Structured Climber | Loves plans, responds to challenge | RIVAL | 4 | "Good. I'm ahead. You can close the gap — if you actually do the work." |
| The Lone Wolf | Rebels against external pressure, self-directed | SILENT FORCE | 3 | "You work alone. So do I." |
| The Social Performer | Driven by visibility, audience-motivated | RIVAL | 3 | "You care what they think. I only care what the data says." |

---

## 14. SCREEN REFERENCE — QUICK LOOKUP

| Area | File(s) | Notes |
|---|---|---|
| Root flow | `SplashScreen`, `SignUpScreen` | RootStack |
| Onboarding | `OnboardingFramingScreen`, `OnboardingQuestionScreen`, `ArchetypeRevealScreen`, `Onboarding7DayScreen`, `TwinIntroductionScreen`, `NotificationPermissionScreen` | OnboardingStack; long questionnaire + API `question_key` per step |
| Main tabs | `HomeScreen`, `LeaderboardScreen`, `TwinComparisonScreen`, `WeeklyReportScreen` | MainTabNavigator |
| Profile | `ProfileScreen`, `ProfileAbilitiesScreen`, `ProfileStreakScreen`, `ProfileInterestsScreen`, `ProfileIdentityScreen`, `ProfileCompanionScreen`, `ProfileQuitsScreen` | ProfileStack; tabs live under `components/profile/` |
| Settings / account | `SettingsScreen`, `ProfileEditScreen`, `AccountScreen`, `ContactUsScreen`, `SettingsFaqScreen` | MainStack |
| Twin | `TwinChatScreen`, `ToneHistoryScreen` | MainStack |
| Mail | `MailInboxScreen` | MainStack |
| Reports | `WeeklyReportScreen`, `PastReportDetailScreen`, `DayDetailScreen` | Tabs + stack |
| Journal | `JournalListScreen`, `JournalEditorScreen`, `JournalCalendarScreen` | MainStack |
| Missions | `MissionDetailScreen` | MainStack |
| Sigil | `SigilScreen` | MainStack |
| Paywall / subs | `PaywallScreen` | MainStack; `SubscriptionManagement` may exist in `MainStackParamList` — confirm `MainStack.tsx` registers it |
| Share / rank | `RankCardScreen`, `ShareableCardsPreviewScreen` | MainStack |
| Overlays | `CharacterEvolutionOverlay`, `PetUnlockOverlay`, `StreakAchievementOverlay`, `SigilLevelUpOverlay`, milestone modals, etc. | Used from Home / mission flow — search `components/` |

---

## 15. CURSOR SESSION OPENER — USE THIS EVERY TIME

```
I am building ALTER EGO.
Stack: React Native + Expo + NativeWind v4 + TypeScript + Zustand + React Query + FastAPI (Python 3.11.9) + Supabase.
Animation: No Rive. Characters and pets use Pika-generated MP4 clips via expo-av. UI animations use Reanimated 3.
Frontend: API client (src/services/api.ts), auth store and user store (src/store), AppProviders. Screens use these; do not call Supabase auth or raw fetch from screens.
Backend: Import from app.core.constants, app.core.supabase_client. Routers registered in main.py (missions, twin, profile, quits, sigil, stats, …).
CLAUDE.md in project root: product voice + design tokens + navigation map + pointers to constants.py for numbers.
Today I am building: [FEATURE].
Refer to CLAUDE.md for colours/spacing; refer to app/core/constants.py for XP/PF/streak/trial values — they change in code first.
```

---

## 16. COMMON MISTAKES — NEVER DO THESE

| Wrong | Right |
|---|---|
| Using Inter as `fontFamily: 'Inter'` without loading | Load via `@expo-google-fonts/inter` in App.tsx first |
| Using `#9333EA` or `#7C3AED` for violet | Use exactly `#8B5CF6` (violet) or `#6D28D9` (violetDeep) |
| Using green for success states | Use `#8B5CF6` glow. No green anywhere. |
| Using bright red for danger | Use `#7F1D1D` deep crimson only |
| Using `backgroundColor: '#000'` for app bg | Use `#0D0F1A → #07080F` gradient |
| Adding NativeWind babel plugin in v4 | v4 does not need the babel plugin — remove it |
| Using `StyleSheet.create` for gradients | Use `expo-linear-gradient` component |
| Hardcoding padding as `15` or `17` | All spacing must be 4, 8, 12, 16, 24, 32, 40, or 48 |
| Using `fontSize: 13` not in the scale | Stick to: 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32 |
| Touch targets under 44px | All tappable elements minimum 44×44px |
| Using coins or any third currency | Primary mission rewards: **XP + Pet Food**. **Aether/sigil** is metaprogression (§21), not a spendable coin economy. |
| Using PATCH for mail read | Use **POST** `/api/v1/mail/{id}/read` and **POST** `/mail/read-all` |
| Showing pet before unlock day | Pet unlocks day **6** since registration (`PET_UNLOCK_DAY`); `pet_unlocked` false until then. |
| Any guilt-based language in UI copy | Pride only. Never guilt. |
| Using Rive for pet or character animation | No Rive. Use Pika MP4 clips via expo-av. |
| Gold (#F59E0B) anywhere except 365-day streak | Gold is reserved exclusively for the 365-day milestone. |
| Hardcoding "Today's Missions" before any mission is done | Use "Start anywhere" when daily_completed_count = 0 |
| Showing per-mission streak on Personal missions | Mission streak (🔥N) shows on Core + Interest (+ Resistance if used); not Personal |
| Twin level badge same as user level | Twin level badge always = user_level + 1 (capped at L10) |
| Guilt-based nudge copy | Nudges are factual + in-character. No pleading. No "you're letting yourself down." |
| Calling supabase.auth or fetch directly from screens | Use useAuthStore / useUserStore and apiClient from @/services/api |
| Missing babel module-resolver for @/ | Add module-resolver with alias "@": "./src"; keep react-native-reanimated/plugin last |

---

## 17. NUDGE & MAIL SYSTEM (BACKEND)

- **Nudge categories:** A (streak warning), B (intervention-hour–based for quit / urge timing), C (general; can send as in-app mail).
- **Intervention hour:** Historically on `quit_targets` (`002_add_intervention_hour.sql`). Quit journeys now centre on **`quit_paths`** — Category B logic should use whatever column the current schema exposes for “urge window” (check migrations `014`+ and `nudge_agent`).
- **In-app mail:** `app_mails`; welcome + Category C. Mail API: GET inbox, PATCH read. `user_local_maintenance_job` / mail service send scheduled mail; profile overview returns `unread_mail_count`.
- **Milestone pushes:** `complete_mission` calls `send_category_c_notification` for streak / stage / pet milestones.
- **Mail HTTP verbs:** Read endpoints are **`POST`** (`/mail/{id}/read`, `/mail/read-all`), not PATCH.

---

## 18. REST API SURFACE (`/api/v1/…`)

Authoritative list from `app/api/*.py`. Mobile should call these via `src/services/api.ts` wrappers where they exist.

| Prefix | Methods | Paths / purpose |
|---|---|---|
| **`/auth`** | POST | `/verify-token`, `/link-google` |
| | GET | `/me` — session user + flags |
| **`/`** (onboarding router) | POST | `/onboarding/step`, `/onboarding/complete`, `/users/create-profile` |
| | GET | `/onboarding/progress`, `/users/check-username` |
| **`/missions`** | GET | `/today`, `/date/{date_str}`, `/journal`, `/journal/{entry_id}`, `/{mission_id}` (detail) |
| | POST | `/{mission_id}/complete`, `/{mission_id}/rate`, `/journal/save`, `/personal/estimate`, `/personal/create`, `/core/difficulty`, `/generate-interest`, `/generate-resistance` |
| | DELETE | `/personal/{mission_id}` |
| **`/twin`** | POST | `/chat`, `/chat/{message_id}/rate`, `/tone-rating` |
| | GET | `/chat/history`, `/tone-history`, `/strip`, `/state` |
| **`/leaderboard`** | GET | `/`, `/rank` |
| **`/reports`** | GET | `/weekly`, `/weekly/detail/{report_id}`, `/weekly/previous`, `/day/{date_str}` |
| **`/mail`** | GET | `/` — inbox + unread count |
| | POST | `/{mail_id}/read`, `/read-all` |
| **`/profile`** | GET | `/overview`, `/streak`, `/identity`, `/companion`, `/interests`, `/quits` |
| | PATCH | `/interests/{interest_id}/quest/criterion` |
| | POST | `/interests/{interest_id}/quests/{quest_id}/complete` |
| | PUT | `/interests/{interest_id}/difficulty`, `/schedule`, `/goal` |
| | DELETE | `/interests/{interest_id}` |
| **`/settings`** | GET | `/faq` (no auth) |
| | POST | `/username`, `/notifications`, `/feedback` |
| | DELETE | `/account` |
| **`/stats`** | GET | `/` — character stats / SP (`stat_service`) |
| **`/quits`** | GET | `/` — list quit paths |
| | POST | `/`, `/{path_id}/frequency`, `/{path_id}/advance-phase` |
| | PATCH | `/{path_id}/trigger-profile` |
| | DELETE | `/{path_id}` |
| **`/sigil`** | GET | `/` — sigil / aether UI state (`sigil_service.get_sigil_data`) |

---

## 19. MOBILE API CLIENT LAYER

**Base client:** `src/services/api.ts` — all paths relative to `EXPO_PUBLIC_API_URL` (e.g. `/api/v1/...`).

**Service modules** (thin wrappers + types; prefer these from hooks/screens):

| File | Typical responsibility |
|---|---|
| `auth.ts` | Sign-in helpers used with `authStore` |
| `onboarding.ts` | Step/progress/complete/check-username/create-profile |
| `missions.ts` | Today, complete, rate, journal, personal estimate/create, core difficulty, generate-interest/resistance |
| `profile.ts` | Overview, streak, identity, companion, interests CRUD + quests, quits summary |
| `twin.ts` | Chat, history, ratings, strip, state |
| `leaderboard.ts` | List + rank |
| `reports.ts` | Weekly, detail, previous, day |
| `mail.ts` | Inbox, mark read, read-all |
| `quits.ts` | Quit paths API parity with backend |
| `stats.ts` | GET stats / abilities |
| `sigil.ts` | GET sigil state |

**Hooks** (`src/hooks/`): `useMissions`, `useTwin`, `useTwinStrip`, `useJournal`, `useProfile`, `useOnboarding`, `useQuits`, `useInterests`, `useStats`, `useSigil` — use for React Query–backed data; keep screens on hooks + stores, not raw `fetch`.

---

## 20. SCHEDULER JOBS (APScheduler)

All registered in `app/core/scheduler.py`. The worker runs an **hourly** tick; each job filters users by **`users.timezone`** and usually **local hour == 1** (1:00–1:59), except nudges.

| Job ID | Function | When / what |
|---|---|---|
| `daily_mission_reset` | `daily_mission_reset_job` | Local **hour 1**: ensure core missions exist for today; `sync_today_planner_missions`; `ensure_sp_day_aligned` + `set_total_missions_for_day` (stats); **`reset_daily_surge`** (sigil). On-demand: `GET /missions/today` still creates rows between midnight and 1:00 if user opens app. |
| `pet_unlock_check` | `pet_unlock_check_job` | Local **hour 1**: pet unlock from `PET_UNLOCK_DAY`; **`handle_streak_break`** when `last_streak_date` is before today. |
| `twin_simulation` | `twin_simulation_job` | Local **hour 1**: `simulate_twin_day`; **`update_strip_message`** (strip_message_service). |
| `user_local_maintenance` | `user_local_maintenance_job` | Local **hour 1**: yesterday day summary, **`calculate_power_score`**, scheduled **`send_app_mail`** (day_7, twin_guide, etc.). |
| `weekly_report` | `weekly_report_local_job` | Local **Sunday, hour 3** (03:00–03:59); batches `generate_weekly_report` (50 users parallel). |
| `twin_recalibration` | `twin_recalibration_job` | Local **hour 1**: first calibration when `days_since_registration >= FIRST_RECALIBRATION_DAY` (**7**), then every **`RECALIBRATION_INTERVAL_DAYS` (7)** from `last_calibration_at`; calls `recalibrate_twin` + optional `send_app_mail` (`twin_recalibration_note`). |
| `nudge_check` | `nudge_check_job` | Hourly (Category A/B timing inside `nudge_agent`). |

Constants: `FIRST_RECALIBRATION_DAY`, `RECALIBRATION_INTERVAL_DAYS` in `app/core/constants.py`.

---

## 21. SIGIL / AETHER SYSTEM

- **Persistence:** `sigil_state` (and related tables per migrations `009`–`012`, **`019` rebuild**). **`aether_log`** for history where enabled.
- **Logic:** `app/services/sigil_service.py` — `check_and_award_aether` runs from **`complete_mission`**; compares **daily XP** to **`DAILY_XP_CAPS`** for **surge** (crossing cap activates surge); awards **aether** per rules (`AETHER_PER_MISSION`, `AETHER_ALL_COMPLETE_BONUS`, level names from constants).
- **Daily reset:** `reset_daily_surge` in **`daily_mission_reset_job`**.
- **API:** `GET /api/v1/sigil` → `get_sigil_data`. Mobile: `services/sigil.ts`, `useSigil`, **`SigilScreen`**, overlays (e.g. `SigilLevelUpOverlay`).
- **Product note:** Aether/sigil is **metaprogession / flair**, not a third spendable currency like “coins.” Primary rewards remain **XP + Pet Food**; sigil rides on top of mission completion and caps.

---

## 22. SETTINGS FAQ vs CONSTANTS

Static FAQ copy lives in **`app/api/settings.py`** (`FAQ_ITEMS`). It can **drift** from `constants.py` (e.g. streak rules, XP caps). When changing product numbers, **update FAQ strings** in the same PR or add a ticket — users see FAQ as truth.

---

*ALTER EGO · CLAUDE.md · v2.2 · March 2026 · Keep in project root; sync with `constants.py` + migrations + `settings.py` FAQ when behaviour changes.*
