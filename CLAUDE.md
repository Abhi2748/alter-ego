# ALTER EGO — CLAUDE.md
# Cursor reads this file automatically every session.
# Never ask me to re-explain the project. Everything is here.

---

## 1. PROJECT IDENTITY

- **App name:** ALTER EGO: The Adaptive Discipline Engine
- **Type:** Mobile app (iOS + Android)
- **Tagline:** "The you that showed up every day. Meet them."
- **Core mechanic:** Shadow Twin — an AI rival always exactly one week of consistent behaviour ahead
- **Primary emotion:** Pride. Never guilt.
- **Target user:** 18–28. Pain point: "I know what I need to do, I just can't make myself do it consistently."
- **Revenue:** 14-day full free trial → $9/month. No credit card at signup. No permanent free tier.

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Mobile frontend | React Native + Expo (iOS + Android) |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| Backend | FastAPI (Python 3.11.9) — Render free tier |
| Database | Supabase (PostgreSQL) — Auth, Storage, Realtime |
| Authentication | Supabase Auth — Google OAuth + Apple + Email |
| AI Agents | LangGraph + GPT-4o-mini (all 5 agents) |
| Agent memory | Supabase pgvector |
| Analytics | PostHog free tier |
| Pet animation | Rive (2 states: Happy/Sad) + rive-react-native |
| In-app purchases | RevenueCat |
| Push notifications | Expo Push Notifications |
| Version control | GitHub — single repo 'alter-ego' |
| Code editor | Cursor IDE |

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
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── navigation/
│   │   ├── constants/
│   │   │   └── theme.ts
│   │   ├── agents/
│   │   └── store/
│   └── assets/
│       ├── images/
│       │   ├── characters/   # character_1_male.png … character_6_female.png
│       │   └── pets/         # pet_1_cub_happy.png … pet_8_dragon_sad.png
│       └── rive/             # pet_1_cub.riv … pet_8_dragon.riv
├── alter-ego-backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── routes/
│   ├── models/
│   ├── agents/
│   └── utils/
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

  // Text
  text:         '#E5E7EB',   // headings, primary text — NOT pure white
  text2:        '#9CA3AF',   // secondary text, descriptions
  muted:        '#6B7280',   // timestamps, metadata, subtext

  // States
  danger:       '#7F1D1D',   // error, pet warning — NEVER bright red
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
  emberGlow: '#FB923C', text: '#E5E7EB', text2: '#9CA3AF',
  muted: '#6B7280', danger: '#7F1D1D',
}
```

**Colour rules — never break these:**
- No green anywhere in the app. Success state = violet glow.
- Orange (#F97316) appears ONLY on streak flame icon. Nowhere else.
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
  micro:    { size: 11, weight: '500', tracking: 0.4 },   // timestamps, legal
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
  cardGap:          12,   // gap between cards in a list (only non-8 multiple — looks better)
  sectionGap:       24,   // gap between sections on a screen
  cardPadding:      16,   // internal padding inside cards
  heroToSection:    24,   // hero zone to next section
  contentPaddingBottom: 96,  // bottom of scrollable content (clears nav bar)
};
```

### 5.4 Border Radius

```typescript
export const RADIUS = {
  chip:   10,   // small chips, tags, difficulty badges
  card:   16,   // mission cards, buttons, modals
  modal:  24,   // large modals, bottom sheets, report card
  full:   9999, // circles, pills
};
```

### 5.5 Shadows

```typescript
// React Native shadows — use both shadowProps (iOS) and elevation (Android)
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
// Cell size: 12×12px (Home), 14×14px (Profile Streak tab)
// Cell gap: 3px, Cell radius: 3px
```

---

## 6. ANIMATION SYSTEM

**Library:** React Native Reanimated (already installed). Requires `react-native-reanimated/plugin` in babel.config.js plugins array.

```typescript
export const ANIMATIONS = {
  // Durations (ms)
  tap:          100,    // press feedback
  cardAppear:   200,    // list items appearing
  transition:   260,    // screen transitions, modals
  missionBurst: 450,    // mission complete burst
  twinkPulse:   600,    // Twin strip new message glow
  xpFill:       260,    // XP bar fill
  evolution:    2400,   // full evolution cinematic (2000–2600ms range)

  // Easing — two only
  standard:    'easeOut',    // most UI interactions
  cinematic:   'easeInOut',  // evolution, big reveals

  // Press animation — apply to ALL buttons and tappable cards
  pressScale:  0.97,         // scale on press
  pressIn:     80,           // ms
  pressOut:    120,          // ms (spring: damping 15, stiffness 200)

  // Card appear stagger
  staggerDelay: 60,          // ms per card index
  staggerMax:   300,         // cap at index 5 (300ms max delay)

  // Glow pulse (Twin alert strip)
  glowMin:     0.2,
  glowMax:     0.7,
  glowRepeats: 3,
};
```

**The 6 animations to implement (in priority order):**
1. Press/tap feedback — scale 1.0 → 0.97 → 1.0 — on every button + card
2. Card appear — opacity 0→1 + translateY +12→0, staggered — on all list renders
3. Glow pulse — Twin Alert Strip border opacity 0.2→0.7→0.2, 3× — on new Twin message
4. Mission complete burst — radial glow + card exit right — on swipe complete
5. XP bar fill — width animates 260ms easeOut — on any XP gain
6. Character evolution — full 6-phase cinematic — on XP threshold crossed (PRIORITY)

---

## 7. NAVIGATION STRUCTURE

```
Root Stack
├── SplashScreen           (auto-advances after 2500ms)
├── SignUpScreen
├── OnboardingStack
│   ├── OnboardingFramingScreen
│   ├── OnboardingQuestionScreen  (reusable, used for Q1–Q10)
│   ├── ArchetypeRevealScreen
│   └── TwinIntroductionScreen    (resets stack on Enter → MainTabNavigator)
└── MainTabNavigator
    ├── Tab 1: HomeScreen
    ├── Tab 2: LeaderboardScreen
    ├── Tab 3: TwinComparisonScreen  ← center tab, raised button
    ├── Tab 4: WeeklyReportScreen
    └── Tab 5: ProfileScreen
        └── SettingsScreen (pushed from Profile header)

Modal screens (pushed over tabs, not tabs themselves):
├── TwinChatScreen         (from Twin Alert Strip or Twin Comparison)
├── CharacterEvolutionOverlay  (Modal, triggered when XP threshold crossed)
├── PaywallScreen          (Modal, non-dismissable, shown at Day 14+)
└── RankCardScreen         (pushed from Profile or Leaderboard)
```

**Bottom nav specifics:**
- 5 tabs. Tab 3 (Twin) is a raised circular button — not a standard tab.
- Active tab: icon + label color #8B5CF6
- Inactive tab: icon + label color #6B7280
- Active glow shadow: rgba(139,92,246,0.5)
- Height: 56px + safe area bottom inset
- Background: rgba(10,12,20,0.95), backdropFilter blur 12px, border top 1px #2A3050

---

## 8. COMPONENT REFERENCE

All components live in `src/components/`. Props interfaces must stay stable — backend wiring in Phase 2 depends on them.

| Component | Key props | Part 1 ref |
|---|---|---|
| PrimaryButton | label, onPress, disabled, loading, icon | §2.1 |
| OnboardingOptionCard | label, selected, onSelect | §2.2 |
| MissionCard | title, category, difficulty, xpValue, petFoodValue, status, onComplete | §2.2 |
| LeaderboardRowCard | rank, username, stageTitle, characterStage, petStage, streak, powerScore, isOwnRow | §2.2 |
| DifficultyChip | level ('Easy'\|'Medium'\|'Hard') | §2.3 |
| TextInput | value, onChange, placeholder, maxLength | §2.4 |
| Slider | value, onChange, min, max, step | §2.4 |
| XPProgressBar | currentXP, nextStageXP, nextStageName | §2.5 |
| BottomNavBar | activeTab, onTabPress | §2.6 |
| TopBar | username, stageTitle, powerScore | §2.7 |
| BottomSheet | visible, onClose, children | §2.8 |
| TwinAlertStrip | message, hasNewMessage, onPress | §2.9 |
| StreakHeatmap | data (365 day array) | §2.10 |
| OnboardingProgressBar | questionNumber (1-10) | §2.11 |
| SkeletonLoader | width, height, radius | §2.12 |
| EmptyState | type, message | §2.13 |
| PetAnimation | stage (1-8), isHappy, size | Part 2 §2.3 |

---

## 9. PRODUCT DECISIONS — ALL LOCKED

### Character System
- 6 stages: The Awakened (0 XP) → The Focused (10,000) → The Burning (50,000) → The Relentless (200,000) → The Formidable (600,000) → The Sovereign (1,500,000)
- Art: dark cinematic realism, God of War / Hades / Black Myth aesthetic
- 2 genders selectable in onboarding. 12 illustrations total (6 stages × 2 genders)
- Evolution animation: unskippable 2–3s full screen, particles, new stage title reveal

### Pet System
- 8 stages: Cub (Day 7) → Cat (~Day 21) → Fox (~Day 45) → Wolf (~Day 75) → Snow Leopard (~Day 110) → Panther (~Day 150) → Griffin (~Day 180) → Dragon (~Day 200)
- Pet unlocks at Day 7. No pet during first week.
- 2 animation states only: Happy and Sad. Built in Rive.
- State machine name: 'PetStateMachine'. Boolean input: 'isHappy'.
- Regression: Days 1–29 frozen + pet sad + full recovery possible. Day 30+: dynamic penalty.

### Shadow Twin System
- Twin always exactly one week of consistent behaviour ahead in XP and pet stage.
- Gap never closes. When user gets close, Twin dynamically pushes further ahead.
- Rule-based simulation for XP/pet. LLM (GPT-4o-mini) for all chat.
- Chat scope: discipline, motivation, growth, reflection ONLY. Off-topic: "That won't make you stronger."
- Personality starts from Archetype. Adapts silently via user tone ratings.
- Twin visible on: Home (Alert Strip) + Tab 3 (Twin Comparison). Two access points only.

### Onboarding
- Sign-up FIRST (before questions). Google / Apple / Email.
- 10 questions → Archetype Reveal → Twin Introduction → app.
- 5 Archetypes: The Restless Creator, The Reluctant Achiever, The Structured Climber, The Lone Wolf, The Social Performer.
- Mandatory. No skip.
- Tone: dark, direct, cinematic. Never gamified or playful.
- Pet NOT introduced in onboarding. Twin teased at start, revealed after Archetype.

### Mission System
- Called: Missions
- Sources: system-generated (Planner Agent) + user-created (min 2/day)
- 3 difficulty levels: Easy (base XP), Medium (2× XP), Hard (4× XP)
- No proof of completion in MVP. Swipe right or checkbox only.
- System missions: same day deadline. User missions: up to 24h max.
- Recovery missions: triggered after 2+ missed days, scaled to streak history.

### Reward Economy
- Two types: XP (levels character) + Pet Food (grows pet). No coins.
- Single daily cap covers both. Cap increases with character level and streak.
- Easy=50 XP base, Medium=100 XP, Hard=200 XP (exact values set in Phase 2)

### Leaderboard
- Power Score = (XP stage % × 0.35) + (pet stage 0–1 × 0.20) + (streak/30 × 0.25) + (weekly completion % × 0.20)
- User invisible until 7 consecutive active days.
- Global only for MVP. All-time. No friends system in MVP.
- Each entry: username, character thumbnail, pet icon, streak flame + number, Power Score.

### Monetisation
- 14-day full free trial. No credit card at signup. No permanent free tier.
- $9/month after Day 14. Full features from Day 1.
- RevenueCat handles trial + subscription for iOS + Android.
- Product ID: 'alter_ego_monthly'
- Rating prompt: random Day 4–12, once only → App Store review for chance at extra free week.

---

## 10. DATABASE SCHEMA

All tables use Row Level Security. Policy: `auth.uid() = user_id`.

```sql
-- users
id uuid PRIMARY KEY, email text, created_at timestamptz,
archetype text, discipline_dna jsonb, available_hours_per_day numeric,
interests text[], quit_targets text[], gender text,
trial_start_date timestamptz, subscription_status text,
rating_prompted_at timestamptz, push_token text

-- missions
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
type text CHECK (type IN ('system','user','recovery')),
title text, difficulty text CHECK (difficulty IN ('Easy','Medium','Hard')),
xp_value int, pet_food_value int,
completed_at timestamptz, expires_at timestamptz, created_at timestamptz

-- character_state
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
stage int DEFAULT 1, total_xp int DEFAULT 0,
gender text, last_updated timestamptz

-- pet_state
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
stage int DEFAULT 0, state text DEFAULT 'happy',
consistency_days int DEFAULT 0, last_updated timestamptz

-- twin_state
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
xp int, pet_stage int,
personality_weights jsonb, last_updated timestamptz

-- twin_chat
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
role text CHECK (role IN ('user','twin')),
content text, created_at timestamptz

-- streak_log
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
date date, completion_level int CHECK (completion_level BETWEEN 0 AND 4),
xp_earned int, pet_food_earned int

-- leaderboard_scores
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
power_score numeric, streak int, pet_stage int,
character_stage int, updated_at timestamptz

-- weekly_reports
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
week_start date, narrative text,
power_score_delta int, created_at timestamptz

-- nudges
id uuid PRIMARY KEY, user_id uuid REFERENCES users,
type text, content text, sent_at timestamptz, tone_used text
```

---

## 11. FASTAPI BACKEND STRUCTURE

```python
# main.py — entry point
# All routes prefixed with /api/v1

# Route files:
# routes/auth.py        — /auth/callback (Supabase webhook)
# routes/onboarding.py  — POST /onboarding
# routes/missions.py    — GET /missions, POST /missions, PATCH /missions/{id}
# routes/twin.py        — POST /twin/chat, GET /twin/state
# routes/agents.py      — POST /agents/profile, /agents/plan, /agents/nudge,
#                          /agents/weekly-report, /agents/oracle-line
# routes/leaderboard.py — GET /leaderboard
# routes/user.py        — GET /user/me, PATCH /user/me

# Environment variables (.env):
SUPABASE_URL=
SUPABASE_SERVICE_KEY=        # service role key — never expose to client
OPENAI_API_KEY=
POSTHOG_API_KEY=
```

---

## 12. AI AGENTS — ALL 5

**Model:** GPT-4o-mini for all agents in MVP.
**Framework:** LangGraph.
**Memory:** Supabase pgvector for Twin chat history.

| Agent | Trigger | Input | Output |
|---|---|---|---|
| Profiler (J1) | Onboarding + every 5 completions | Answers + mission history | user_profile JSON → users.discipline_dna |
| Planner (J2) | First login each day | user_profile + interests + daily_hours | 3–6 system missions for today |
| Nudge (J3) | Celery every 2h | streak_log last 48h | Push notification in Twin's tone |
| Shadow Twin (J4) | Each chat message | Conversation history (last 20) + message | Twin response in character |
| Weekly Report (J5) | Every Sunday 7pm | Week's data + twin gap | Oracle narrative + win + focus |

**Shadow Twin Agent system prompt structure:**
```
You are the Shadow Twin of {username}. 
Archetype: {archetype}. Personality blend: {personality_weights}.
You are always exactly one week of consistent behaviour ahead.
Your pet is a {twin_pet_stage}. Theirs is a {user_pet_stage}.
Respond ONLY about: discipline, motivation, growth, reflection.
Off-topic: respond with "That won't make you stronger." — exact phrase.
Tone: {current_tone_blend}. Max 2 sentences per response.
Conversation history: {history}
```

---

## 13. ARCHETYPES — FULL REFERENCE

| Archetype | Behaviour profile | Default Twin tone | Twin first message |
|---|---|---|---|
| The Restless Creator | High novelty, low structure, bursts of intensity | Mocking + playful | "Oh, you finally showed up. My pet is already ahead. Just saying." |
| The Reluctant Achiever | High guilt-sensitivity, perfectionism causing avoidance | Gentle + wistful | "I'm glad you made it. We have a long way to grow. Let's see what you're made of." |
| The Structured Climber | Loves plans, responds well to challenge | Competitive + direct | "Good. I'm ahead. You can close the gap — if you actually do the work." |
| The Lone Wolf | Rebels against external pressure, self-directed | Neutral + curious | "You came. I've been here. The gap is yours to decide." |
| The Social Performer | Driven by visibility, thrives with audience | Mocking + competitive | "Finally. My pet is already evolving. Yours is still a Cub. Keep up." |

---

## 14. SCREEN REFERENCE — QUICK LOOKUP

| Screen | File name | Phase built | Spec |
|---|---|---|---|
| Splash | SplashScreen.tsx | Phase 1 (1.04) | Part 3A Screen 01 |
| Sign-Up | SignUpScreen.tsx | Phase 1 (1.05) | Part 3A Screen 02 |
| Onboarding Framing | OnboardingFramingScreen.tsx | Phase 1 (1.06) | Part 3A Screen 03 |
| Onboarding Questions | OnboardingQuestionScreen.tsx | Phase 1 (1.07–1.08) | Part 3A Screen 04–13 |
| Archetype Reveal | ArchetypeRevealScreen.tsx | Phase 1 (1.09) | Part 3A Screen 14 |
| Twin Introduction | TwinIntroductionScreen.tsx | Phase 1 (1.10) | Part 3A Screen 15 |
| Home | HomeScreen.tsx | Phase 1 (1.18) | Part 3B Screen 16 |
| Twin Comparison | TwinComparisonScreen.tsx | Phase 1 (1.20) | Part 3B Screen 17 |
| Twin Chat | TwinChatScreen.tsx | Phase 1 (1.21) | Part 3B Screen 18 |
| Leaderboard | LeaderboardScreen.tsx | Phase 1 (1.22) | Part 3B Screen 19 |
| Weekly Report | WeeklyReportScreen.tsx | Phase 1 (1.23) | Part 3B Screen 20 |
| Profile | ProfileScreen.tsx | Phase 1 (1.24–1.27) | Part 3B Screen 21 |
| Settings | SettingsScreen.tsx | Phase 1 (1.28) | Part 3B Screen 22 |
| Evolution Overlay | CharacterEvolutionOverlay.tsx | Phase 1 (1.31) | Part 3B Screen 23 |
| Paywall | PaywallScreen.tsx | Phase 1 (1.29) | Part 3B Screen 24 |
| Rank Card | RankCardScreen.tsx | Phase 1 (1.30) | Part 3B Screen 25 |

---

## 15. CURSOR SESSION OPENER — USE THIS EVERY TIME

```
I am building ALTER EGO. 
Stack: React Native + Expo + NativeWind v4 + FastAPI (Python 3.11.9) + Supabase.
CLAUDE.md in project root contains all design tokens, colours, spacing, and decisions.
Today I am building: [ITEM NAME FROM PART 4].
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
| Showing pet before Day 7 | Pet unlocks at Day 7 as first milestone |
| Any guilt-based language in UI copy | Pride only. Never guilt. |

---

*ALTER EGO · CLAUDE.md · v1.0 · March 2026 · Keep this file in project root always*
