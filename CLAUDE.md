Create a file called CLAUDE.md in the project root D:\alter-ego with the following content exactly:

# ALTER EGO — Cursor Context

## What We Are Building
ALTER EGO is a mobile discipline app. Core mechanic: a Shadow Twin — an AI rival always one week of consistent behaviour ahead of the user. Both user and Twin have a companion pet that evolves through 8 stages (Cub → Dragon). Primary emotion: Pride. Never guilt.

## Tech Stack
- Mobile: React Native + Expo + NativeWind v4 (NOT v3)
- Backend: FastAPI + Python 3.11.9 + Supabase + Render
- AI Agents: LangGraph + GPT-4o-mini (5 agents)
- Animations: Rive (pet states) + React Native Reanimated (UI)
- Analytics: PostHog

## Folder Structure
D:\alter-ego
├── alter-ego-mobile/     (React Native + Expo)
│   └── src/
│       ├── screens/
│       ├── components/
│       ├── hooks/
│       └── utils/
└── alter-ego-backend/    (FastAPI)
    ├── routes/
    ├── models/
    ├── agents/
    └── utils/

## NativeWind v4 Rules (CRITICAL)
- global.css contains @tailwind base/components/utilities
- metro.config.js uses withNativeWind wrapper pointing to global.css
- tailwind.config.js includes nativewind/preset and correct content paths
- babel.config.js does NOT include nativewind/babel plugin (v4 does not need it)
- App.js imports global.css as the very first line
- Always use className for styling, never StyleSheet for new components

## Design System (ALWAYS follow these exactly)
- App background: #0D0F1A → #07080F gradient (NOT pure black)
- Card surface: #141824 with 1px border #1E2333
- Primary violet: #8B5CF6 (buttons, XP bar, active states)
- Deep violet: #6D28D9 (progress bars, active nav)
- Glow violet: #A78BFA (particles, glows — never flat fill)
- Twin fracture line: #C084FC (2px line only)
- Streak flame: #F97316 (streak ONLY)
- Heading text: #E5E7EB (not pure white)
- Secondary text: #9CA3AF
- Muted text: #6B7280
- Danger: #7F1D1D
- Success: #8B5CF6 glow — never green
- Font: Inter — single font throughout
- Border radius: Cards 16px, Buttons 16px, Chips 10px, Modals 24px
- Spacing: 8pt grid — tokens: 4, 8, 16, 24, 32, 40, 48
- Screen padding: 16px

## Character System
- 6 stages: The Awakened → The Focused → The Burning → The Relentless → The Formidable → The Sovereign
- XP thresholds: 0 / 10,000 / 50,000 / 200,000 / 600,000 / 1,500,000
- Art style: Dark cinematic realism. God of War / Hades / Black Myth aesthetic
- Evolution animation: unskippable 2-3s full screen, particle burst, new title reveal

## Pet System
- 8 stages: Cub → Cat → Fox → Wolf → Snow Leopard → Panther → Griffin → Dragon
- Unlocks at Day 7. 2 animation states only: Happy and Sad (built in Rive)
- Twin pet always exactly one week of consistent behaviour ahead

## Shadow Twin
- Always one week ahead in XP and pet stage. Gap never closes.
- Rule-based simulation for progression. LLM handles all chat.
- Personality starts from Archetype. Adapts via tone ratings silently.

## Navigation
- 5 tabs: Home, Leaderboard, Twin (center), Report, Profile

## Monetisation
- 14-day full free trial → $9/month. No credit card at signup.

## Key Rules
- Never use green for success — always violet glow
- Never use bright red for errors — always #7F1D1D deep crimson
- Orange #F97316 for streak flame ONLY — nowhere else
- Always Inter font, never switch fonts
- Always dark background, never white screens
- Production-grade code only — no shortcuts