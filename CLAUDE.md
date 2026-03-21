# ALTER EGO — CLAUDE.md
# Cursor reads this file automatically every session.
# Never ask me to re-explain the project. Everything is here.
# v2.0 — Updated March 2026

---

## 1. PROJECT IDENTITY

- **App name:** ALTER EGO: The Adaptive Discipline Engine
- **Type:** Mobile app (iOS + Android)
- **Tagline (external):** "Your rival is you — one week ahead."
- **Tagline (subtitle / optional):** "We learn you in 14 days. Your only job: show up."
- **Core mechanic:** Shadow Twin — an AI rival always exactly one week of consistent behaviour ahead
- **Primary emotion:** Pride. Never guilt.
- **Target user:** 18–28. Pain point: "I know what I need to do, I just can't make myself do it consistently."
- **Revenue:** 14-day full free trial → $9/month. No credit card at signup. No permanent free tier.

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
| AI Agents | LangGraph + GPT-4o-mini (all 5 agents) |
| Agent memory | Supabase pgvector |
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
│   │   ├── services/         # api.ts (base client), auth.ts
│   │   ├── store/            # authStore.ts, userStore.ts (Zustand)
│   │   ├── providers/        # AppProviders.tsx (React Query + auth init)
│   │   ├── utils/            # supabase.ts (single Supabase client: SecureStore + guest mode + fetchWithRetry)
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── navigation/
│   │   ├── constants/
│   │   │   └── theme.ts
│   │   └── agents/
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
│   ├── migrations/           # 001_initial_schema.sql, 002_add_intervention_hour.sql
│   └── app/
│       ├── api/              # auth, mail, missions, onboarding, profile, reports, settings, twin, leaderboard
│       ├── core/             # constants, supabase_client, scheduler, archetype
│       ├── services/         # mission_service, mail_service, onboarding_service, audit_service, etc.
│       └── agents/           # planner_agent, nudge_agent, twin_chat_agent, report_agent, etc.
├── CLAUDE.md                 ← this file
└── progress.md               ← one sentence: what to build tomorrow
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
  - `fetchProfile()` — called when user becomes authenticated (from AppProviders).
  - Optimistic updates: `updateXP`, `updatePF`, `updateStreak`, `updateStage`, `updatePetStage`, `incrementUnreadMail`, `clearProfile`.
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
| H2 | Pet Unlock (Cub) | Day 7 streak | Soft overlay, particles converge, Cub fades in |
| H3 | Pet Evolution | Pet stage threshold | White flash + Runway crossfade |
| H4 | Streak Milestone | 3/7/14/30/60/100/180/365 day streaks | 3 intensity tiers. 365 = ONLY gold in app |
| H5 | Twin Chat Unlock | Stage 2 reached | Strip expands, "SPEAK WITH YOUR TWIN" |
| H6 | Leaderboard Unlock | 10-day streak | Tab pulse + banner drop |

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

```
Root Stack
├── SplashScreen           (auto-advances after 2500ms)
├── SignUpScreen
├── OnboardingStack
│   ├── OnboardingFramingScreen   ("We don't count perfect days. We count the ones you showed up.")
│   ├── OnboardingQuestionScreen  (reusable, used for Q1–Q10)
│   ├── ArchetypeRevealScreen     (includes Twin first line at 2400ms — first Twin voice encounter)
│   └── TwinIntroductionScreen    (resets stack on Enter → MainTabNavigator)
└── MainTabNavigator
    ├── Tab 1: HomeScreen
    ├── Tab 2: LeaderboardScreen
    ├── Tab 3: TwinComparisonScreen  ← center tab, raised button
    ├── Tab 4: WeeklyReportScreen
    └── Tab 5: ProfileScreen
        └── SettingsScreen (pushed from Profile header)

Modal screens (pushed over tabs):
├── TwinChatScreen              (unlocks at Stage 2 — The Focused)
├── CharacterEvolutionOverlay   (Modal, triggered on XP threshold crossing)
├── PetUnlockOverlay            (Modal, triggered on Day 7 streak)
├── MilestoneAchievementCard    (Modal, triggered on interest milestones)
├── JournalEditorScreen         (pushed from Core mission "Daily Journal" tap)
├── PaywallScreen               (Modal, non-dismissable, shown at Day 14+)
└── RankCardScreen              (pushed from Profile or Leaderboard)
```

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
| MissionCard | title, category, difficulty, xpValue, petFoodValue, status, onComplete, missionType, missionStreak | missionStreak: shows 🔥N below title for Core+Interest only when ≥2 |
| LeaderboardRowCard | rank, username, stageTitle, characterStage, petStage, streak, powerScore, isOwnRow | petStage icon visible in row |
| TypeChip | type ('core'\|'interest'\|'personal'\|'recovery') | |
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
| OnboardingProgressBar | questionNumber (1-10) | 3px, no counter |
| SkeletonLoader | width, height, radius | |
| EmptyState | type, message | |
| PetAnimation | stage (1-8), petState, size, roaming | petState: 'idle'\|'walk'\|'happy'\|'sad'\|'react'\|'sleep'. roaming=true on Home only. |
| DayOfWeekChart | data ({mon,tue,wed,thu,fri,sat,sun}: 0–1) | Report screen only |
| InterestLevelBadge | level (1-10), isGolden | Golden ring at L10 |
| TwinLevelBadge | level (1-10) | Beside user level in Interests tab. Always 1 ahead. |

---

## 9. PRODUCT DECISIONS — ALL LOCKED

### Character System
- **6 stages:** The Awakened → The Focused → The Burning → The Relentless → The Formidable → The Sovereign
- **XP thresholds (exact):** S1=0 / S2=800 / S3=5,000 / S4=20,000 / S5=60,000 / S6=200,000
- Art: dark cinematic realism, God of War / Hades / Black Myth aesthetic
- 2 genders selectable in onboarding. 12 illustrations total (6 stages × 2 genders).
- 12 idle clips (Pika MP4, 4s loop each). Intensity scales S1 (barely moves) → S6 (constant energy aura).
- Evolution: unskippable H1 cinematic, 7 phases, 3900ms total.

### Pet System
- **8 stages:** Cub (Day 7) → Cat → Fox → Wolf → Snow Leopard → Panther → Griffin → Dragon
- **Pet Food thresholds (exact):** auto Day 7 / Cat=400 / Fox=2,000 / Wolf=7,000 / Snow Leopard=18,000 / Panther=40,000 / Griffin=80,000 / Dragon=150,000
- Pet unlocks at Day 7. No pet visible during first 6 days.
- **6 clip states per pet:** idle / walk / happy / sad / react / sleep (48 total MP4 clips, Pika-generated)
- Pet roams freely across Home screen (Section 6.3 above). Not confined to hero zone.
- **State priority:** sad > sleep > happy > idle/walk
- Regression: Days 1–29 frozen + pet sad + full recovery possible. Day 30+: dynamic penalty.

### Shadow Twin System
- Twin starts at exact same point as user on Day 1. The gap is created entirely by the user's behaviour.
- Twin simulates near-perfect consistency. Gap calculated dynamically every 3 days.
- **4 gap states:** AHEAD / CLOSING / MATCHED / PASSED (user overtook Twin = most memorable moment)
- **3 tone types:** RIVAL (competitive, direct) / PHILOSOPHER (reflective, wistful) / SILENT FORCE (minimal, factual)
- **4 adaptation parameters in discipline_dna:** tone_type / intensity (1–5) / gap_behavior / challenge_level
- Recalibration: initial at onboarding, first behaviour calibration on **day 7**, then every **7** days. Never jumps >1 intensity point per cycle.
- Twin strip messages are rule-based (no LLM cost). LLM only invoked when user opens Twin Chat.
- Twin Chat scope: discipline, motivation, growth, reflection ONLY. "That won't make you stronger." for off-topic.
- **Twin Chat unlocks at Stage 2 (The Focused).** Not available Day 1.

### Mission System — v2.0
- **3 mission types:** Core (3/day, universal pillars) / Interest (1–3/day, Planner-generated) / Personal (user-created)
- **5 Core pillars:** Sleep / Movement / Hydration / Mindfulness / No-Phone Window
- **Streak definition:** day counts if ALL 3 Core missions complete. Interest+Personal are bonus.
- **Escaper framework:** never "don't do X" — always replacement behaviour. Planner identifies underlying need (boredom/dopamine, stress/anxiety, social/ritual, impulsivity, avoidance, comfort/oral) then generates replacement.
- **Difficulty adaptation:** increases after 5+ days full completion. Decreases after 3+ days <40% completion. Never on a timer — only on evidence.
- **XP values (exact):** Core Easy=15, Medium=25, Hard=40 / Interest Easy=10, Medium=20, Hard=30 / Personal Easy=8, Medium=15, Hard=22
- **Pet Food values (exact):** Core Easy=12, Medium=20, Hard=32 / Interest Easy=8, Medium=16, Hard=24 / Personal Easy=6, Medium=11, Hard=17
- **Daily XP cap by stage:** S1=200 / S2=300 / S3=450 / S4=600 / S5=800 / S6=1000
- Recovery missions: triggered after 2+ missed Core days. Scale with previous streak length.
- Multi-day missions: unlock after day 31 with 60%+ 30-day completion. XP=10/day + 25 completion bonus.
- **Adaptability copy:** Home section header reads "Start anywhere" when 0 missions done today. Switches to "Today's Missions" after first completion.
- Personal goal XP assignment: user writes in free text, system assigns XP tier via GPT-4o-mini estimation. User sees and can adjust tier.

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
| 7-day streak | Pet (Cub) unlocks |
| Stage 2 — The Focused | Twin Chat unlocks |
| 10-day streak | Leaderboard + Rank Card |
| 60-day streak | Weekly Report All-Time section |

**Streak milestone bonuses:**
- 3d: +20XP/+15PF | 7d: +60XP/+50PF | 14d: +120XP/+100PF | 30d: +300XP/+250PF
- 60d: +600XP/+500PF | 100d: +1000XP/+800PF | 180d: +2000XP/+1600PF | 365d: +5000XP/+4000PF + golden year badge

**Rank Cards (unlock at 10-day streak):**
- Portrait 9:16. Background #1E1B4B. Contains: character art, stage title, username, pet icon+name, Power Score (large), streak, last Twin strip message as pull-quote, ALTER EGO wordmark.
- NOT on card: XP numbers, leaderboard rank, completion rates.
- Auto-regenerates on stage change, pet evolution, 365-day streak.
- Year badge (golden ring) at 365-day streak — only gold element on the card.

**Interest Levels (per interest, L1–L10):**
- Each interest has its own XP counter. L10 = genuine long-term achievement.
- Thresholds: L1=0 / L2=200 / L3=600 / L4=1,400 / L5=3,000 / L6=6,000 / L7=11,000 / L8=18,000 / L9=28,000 / L10=42,000
- Shown in Profile → Interests tab. User level badge beside Twin level badge (always 1 ahead).
- L10 badge gets golden ring.

### Nudge System
- **5 nudge types (priority order):** Streak Warning > Re-engagement > Pet Nudge > Milestone Approaching > Momentum
- **Frequency caps:** Low=1/day (streak warning only) / Medium=2/day / High=3/day
- Hard rules: never if app opened today. Never after 10pm local. Never guilt. One topic per nudge.
- Copy generation: GPT-4o-mini per nudge. Anti-repetition: last 3 nudge texts injected into every call.
- Adaptation: every 7 days, low open rate on type → deprioritise. Consistent opens → upgrade frequency.
- User controls frequency in Settings (Low / Medium / High).

### Weekly Report
- Every Sunday, 3am server time. Available all day. Replaces previous week's report.
- **5 sections:** This Week (pure data, no LLM) / Your Wins (2–3 specific, never invented) / Where You Slipped (1–2 factual, no blame) / Your Twin This Week (Twin voice) / Next Week (Twin voice, one sentence)
- **All-Time section** unlocks at 60-day streak. Pure data assembly, no extra LLM call.
- **Day-of-week chart** in streak block: Mon–Sun bars showing average completion rate per day. Title: "Your Best Days."
- Anti-repetition: previous 2 weeks' generated content injected into each call. Never same opening word, structure, or core observation.

### Leaderboard
- Power Score ranking (formula above).
- Visible after 7 consecutive active days.
- Global only for MVP. No friends system.
- Each row: username, character thumbnail, pet icon (now prominent — petStage prop), streak, Power Score.
- Top 3: gold/silver/bronze rank number tint.
- User's own row: sticky above nav bar, violet border, F8 pulse on load.

### Monetisation
- 14-day full free trial. No credit card at signup. No permanent free tier.
- $9/month after Day 14. Full features from Day 1.
- Trial banner: amber strip below TopBar ("X days left in trial") — dismissable once per day.
- RevenueCat. Product ID: 'alter_ego_monthly'.
- Rating prompt: random Day 4–12, once only → App Store review for chance at extra free week.

---

## 10. DATABASE SCHEMA — v2.0

All tables use Row Level Security. Policy: `auth.uid() = user_id`.

```sql
-- users
id uuid PRIMARY KEY, email text, created_at timestamptz,
archetype text,
discipline_dna jsonb,  -- {tone_type, intensity, gap_behavior, challenge_level, nudge_weights}
available_hours_per_day numeric,
interests text[], quit_targets text[], gender text,
trial_start_date timestamptz, subscription_status text,
rating_prompted_at timestamptz, push_token text,
nudge_frequency text DEFAULT 'medium'  -- 'low'|'medium'|'high' (user-set in Settings)

-- missions
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
type text CHECK (type IN ('core','interest','personal','recovery')),
pillar text,  -- for core missions: sleep/movement/hydration/mindfulness/no-phone
interest text,  -- for interest missions: the interest name
title text, difficulty text CHECK (difficulty IN ('Easy','Medium','Hard')),
xp_value int, pet_food_value int,
mission_streak int DEFAULT 0,  -- consecutive days this mission completed
completed_at timestamptz, expires_at timestamptz, created_at timestamptz

-- character_state
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
stage int DEFAULT 1, total_xp int DEFAULT 0,
gender text, last_updated timestamptz

-- pet_state
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
stage int DEFAULT 0,  -- 0 = no pet (Days 1-6)
pet_health_state text DEFAULT 'idle',  -- 'idle'|'happy'|'sad'|'sleep'
total_pet_food int DEFAULT 0,
consistency_days int DEFAULT 0, last_updated timestamptz

-- twin_state
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
xp int, pet_stage int, streak int,
gap_state text,  -- 'AHEAD'|'CLOSING'|'MATCHED'|'PASSED'
personality_weights jsonb, last_updated timestamptz

-- twin_chat
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
role text CHECK (role IN ('user','twin')),
content text, created_at timestamptz

-- streak_log
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
date date,
core_completed int DEFAULT 0,  -- 0-3 core missions done that day
completion_level int CHECK (completion_level BETWEEN 0 AND 4),
xp_earned int, pet_food_earned int

-- leaderboard_scores
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
power_score numeric, streak int, pet_stage int,
character_stage int, updated_at timestamptz

-- weekly_reports
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
week_start date,
wins jsonb, slipped jsonb, keep_watching text,
twin_paragraph text, twin_closing text, next_week text,
power_score_delta int, created_at timestamptz

-- nudge_log
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
type text, content text, sent_at timestamptz,
tone_used text, opened_at timestamptz  -- null if not opened

-- interest_progress
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
interest text,  -- e.g. 'guitar', 'running'
level int DEFAULT 1,
total_xp int DEFAULT 0,
session_count int DEFAULT 0,
last_session_at timestamptz

-- milestone_log
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
milestone_type text, earned_at timestamptz,
interest_id uuid REFERENCES interests(id), quit_target_id uuid REFERENCES quit_targets(id)

-- app_mails (in-app inbox; welcome mail, Category C nudges)
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
subject text, body_text text, mail_type text,
sent_at timestamptz, read_at timestamptz

-- feedback_submissions (Settings → Contact; optional Zapier webhook)
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
type text CHECK (type IN ('bug','concern','suggestion','other')),
content text, app_version text, created_at timestamptz

-- quit_targets: intervention_hour (0-23) added in 002 — when urge typically hits (Category B nudges)
-- nudge_log: nudge_category ('A'|'B'|'C') added in 002 — for analytics
-- xp_log, streak_log, twin_daily_record: used by profile/streak and related endpoints
```

---

## 11. FASTAPI BACKEND STRUCTURE

```python
# main.py — entry point
# All routes prefixed with /api/v1
# Import from app.core.constants, app.core.supabase_client where applicable.

# Route modules (app.api.*):
# auth.py        — /auth/callback (Supabase webhook), link-google
# onboarding.py — POST /onboarding, check-username
# missions.py   — GET /missions, POST /missions, PATCH /missions/{id}
# twin.py       — POST /twin/chat, GET /twin/state
# leaderboard.py — GET /leaderboard
# reports.py    — GET /reports (weekly report)
# mail.py       — GET /mail (inbox), PATCH /mail/read
# profile.py    — GET /profile/overview, /profile/streak,
#                  /profile/identity, /profile/companion, /profile/interests, /profile/quits
# settings.py   — GET /settings/faq, POST /settings/username, /settings/notifications,
#                  POST /settings/feedback, DELETE /settings/account
# user/me       — GET /user/me, PATCH /user/me (push_token, timezone, last_opened_at)

# Core (app.core.*): constants, supabase_client, scheduler, archetype
# Services (app.services.*): mission_service, mail_service, onboarding_service,
#   progression_service, streak_service, twin_service, power_score_service,
#   strip_message_service, audit_service

# XP/PF audit script (B35) — run manually before beta:
#   cd alter-ego-backend && python -m app.services.audit_service

# Environment variables (.env):
SUPABASE_URL=
SUPABASE_SERVICE_KEY=        # service role key — never expose to client
OPENAI_API_KEY=
POSTHOG_API_KEY=
ZAPIER_WEBHOOK_URL=          # optional; feedback webhook (Formspree URL works here too)
FEEDBACK_WEBHOOK_URL=        # optional; same — JSON POST, or Formspree form-encoded if URL is formspree.io
FORMSPREE_FEEDBACK_URL=      # optional; alias for the same webhook slot
RESEND_API_KEY=              # optional; team email via Resend
FEEDBACK_NOTIFY_EMAIL=       # optional; recipient when using Resend
RESEND_FROM_EMAIL=           # optional; sender (must be verified in Resend)
```

---

## 12. AI AGENTS — ALL 5 (v2.0)

**Model:** GPT-4o-mini for all agents.
**Framework:** LangGraph.
**Memory:** Supabase pgvector for Twin chat history.

| Agent | Trigger | Input | Output |
|---|---|---|---|
| Profiler (J1) | Onboarding + every 7 days | Onboarding answers + behavioural signals | discipline_dna JSON → users table |
| Planner (J2) | Midnight per user timezone | discipline_dna + interests + quit_targets + daily_hours + interest_levels | Full day's missions (Core + Interest + Escaper) |
| Nudge (J3) | Celery 2× daily per user | streak_log + pet_state + nudge_log (last 3) + discipline_dna | Push notification copy in Twin's tone |
| Shadow Twin (J4) | Each chat message | Conversation history (last 20) + discipline_dna + gap_state | Twin response in character, max 2 sentences |
| Weekly Report (J5) | Sunday 3am server time | Week's data + previous 2 weeks' sections (anti-repetition) | {wins[], slipped[], keep_watching, twin_paragraph, twin_closing, next_week} |

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

## 14. SCREEN REFERENCE — QUICK LOOKUP (v2.0)

| Screen | File name | Build item | Spec |
|---|---|---|---|
| Splash | SplashScreen.tsx | 1.04 | Part 3A Screen 01 |
| Sign-Up | SignUpScreen.tsx | 1.05 | Part 3A Screen 02 |
| Onboarding Framing | OnboardingFramingScreen.tsx | 1.06 + 1.42 | Part 3A Screen 03 |
| Onboarding Questions | OnboardingQuestionScreen.tsx | 1.07–1.08 | Part 3A Screen 04–13 |
| Archetype Reveal | ArchetypeRevealScreen.tsx | 1.09 + 1.39 | Part 3A Screen 14 |
| Twin Introduction | TwinIntroductionScreen.tsx | 1.10 | Part 3A Screen 15 |
| Home | HomeScreen.tsx | 1.18 + 1.32 + 1.37 + 1.38 + 1.42 | Part 3B Screen 16 |
| Twin Comparison | TwinComparisonScreen.tsx | 1.20 + 1.34 | Part 3B Screen 17 |
| Twin Chat | TwinChatScreen.tsx | 1.21 | Part 3B Screen 18 |
| Leaderboard | LeaderboardScreen.tsx | 1.22 | Part 3B Screen 19 |
| Weekly Report | WeeklyReportScreen.tsx | 1.23 + 1.36 | Part 3B Screen 20 |
| Profile (shell) | ProfileScreen.tsx | 1.24 | Part 3B Screen 21 |
| Profile: Abilities | AbilitiesTab.tsx + ProfileAbilitiesScreen | — | Character stat system UI (placeholders) |
| Profile: Streak | ProfileStreakTab.tsx | 1.26 | Part 3B Screen 21 Streak |
| Profile: Titles | ProfileTitlesTab.tsx | 1.27 | Part 3B Screen 21 Titles |
| Profile: Interests | ProfileInterestsTab.tsx | 1.35 | Part 3B Screen 21 Interests |
| Settings | SettingsScreen.tsx | 1.28 + 1.43 | Part 3B Screen 22 |
| Evolution Overlay | CharacterEvolutionOverlay.tsx | 1.31 (simplified) → 3.10 (full) | Part 3B Screen 23 |
| Paywall | PaywallScreen.tsx | 1.29 | Part 3B Screen 24 |
| Rank Card | RankCardScreen.tsx | 1.30 | Part 3B Screen 25 |
| Journal Editor | JournalEditorScreen.tsx | 1.41 | Part 3B Screen 26 |
| Milestone Card | MilestoneAchievementCard.tsx | 1.40 | Part 3B Screen 27 |

---

## 15. CURSOR SESSION OPENER — USE THIS EVERY TIME

```
I am building ALTER EGO.
Stack: React Native + Expo + NativeWind v4 + TypeScript + Zustand + React Query + FastAPI (Python 3.11.9) + Supabase.
Animation: No Rive. Characters and pets use Pika-generated MP4 clips via expo-av. UI animations use Reanimated 3.
Frontend: API client (src/services/api.ts), auth store and user store (src/store), AppProviders. Screens use these; do not call Supabase auth or raw fetch from screens.
Backend: Import from app.core.constants, app.core.supabase_client. Routes in app.api.*; profile + settings + mail routers registered in main.py.
CLAUDE.md in project root contains all design tokens, colours, spacing, and decisions.
Today I am building: [ITEM NAME FROM PART 4 v2.0].
Refer to CLAUDE.md for all exact values. Do not approximate any colour, size, or spacing.
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
| Using coins or any third currency | Two reward types only: XP and Pet Food |
| Showing pet before Day 7 | Pet unlocks at Day 7 as first milestone. Stage 0 = no pet. |
| Any guilt-based language in UI copy | Pride only. Never guilt. |
| Using Rive for pet or character animation | No Rive. Use Pika MP4 clips via expo-av. |
| Gold (#F59E0B) anywhere except 365-day streak | Gold is reserved exclusively for the 365-day milestone. |
| Hardcoding "Today's Missions" before any mission is done | Use "Start anywhere" when daily_completed_count = 0 |
| Showing per-mission streak on Personal missions | Mission streak (🔥N) shows on Core + Interest only, never Personal |
| Twin level badge same as user level | Twin level badge always = user_level + 1 (capped at L10) |
| Guilt-based nudge copy | Nudges are factual + in-character. No pleading. No "you're letting yourself down." |
| Calling supabase.auth or fetch directly from screens | Use useAuthStore / useUserStore and apiClient from @/services/api |
| Missing babel module-resolver for @/ | Add module-resolver with alias "@": "./src"; keep react-native-reanimated/plugin last |

---

## 17. NUDGE & MAIL SYSTEM (BACKEND)

- **Nudge categories:** A (streak warning), B (intervention-hour–based for quit targets), C (general; can send as in-app mail).
- **Intervention hour:** On quit_targets, `intervention_hour` (0–23) from onboarding urge_timing; used for Category B nudge timing. Migration: `002_add_intervention_hour.sql` (also adds `nudge_category` to nudge_log).
- **In-app mail:** Table `app_mails`; welcome mail and Category C content. Mail API: GET inbox, PATCH read. Mail service + scheduler jobs in backend; profile overview returns `unread_mail_count`.

---

*ALTER EGO · CLAUDE.md · v2.0 · March 2026 · Keep this file in project root always*
