## ALTER EGO · Project Workflow & Architecture

This document describes how the current ALTER EGO codebase actually works today – mobile app, backend, data flow – so you can reason about behaviour and find the right places to extend it. It follows the real implementation, not just the product spec in `CLAUDE.md`.

---

## 1. High-level user journey

- **Cold start**
  - User opens the app.
  - `App.tsx` loads Inter fonts, registers push notifications (if permitted), and wires `NavigationContainer` with a dark theme.
  - Root navigator is `RootStack` with `initialRouteName="Splash"`.

- **Splash → Sign-up**
  - `SplashScreen` plays the hero splash animation (crack line, figures, logo, tagline; crack sparks and particles). After **5s** it runs `replace("SignUp")`.
  - `SignUpScreen` shows three auth options:
    - **Apple / Google** (Supabase OAuth via `supabase.auth.signInWithOAuth`).
    - **Email magic link** (Supabase OTP).
  - After Supabase completes sign-in:
    - The app ensures required rows exist in Supabase (`users`, `character_state`, `pet_state`, `twin_state`).
    - If this is a brand‑new user, navigation continues into **Onboarding**.
    - If the user already has onboarding data, navigation jumps directly to the **Main tabs**.

- **Onboarding**
  - A dedicated `OnboardingStack` is pushed:
    1. `OnboardingFramingScreen` – philosophy framing and CTA.
    2. `OnboardingQuestionScreen` – reused for all 13 questions, driven by a questions constant.
    3. `ArchetypeRevealScreen` – reveals archetype and Twin’s first line.
    4. `TwinIntroductionScreen` – sets up the rivalry and 14‑day framing; on Begin it resets the stack to the main tabs.
  - On the final onboarding question:
    - The screen collects all answers from `OnboardingAnswersContext`.
    - It calls `POST /api/v1/onboarding` with:
      - Raw answers, interest list, quit targets, available hours per day, gender.
    - Backend:
      - Scores the archetype and builds `discipline_dna`.
      - Upserts the `users` row with trial start & discipline DNA.
      - Ensures `character_state`, `pet_state`, `twin_state` are created.
      - Calls the Planner agent to generate the first day of missions and inserts them.
      - Returns `archetype_content` + `initial_missions`.
    - The app stores `archetype_content` in context and transitions to `ArchetypeRevealScreen`.

- **Main tabs (daily usage)**
  - Once onboarding is complete or skipped, user lands in `MainStack` with:
    - **Tabs** via `MainTabNavigator`:
      1. `HomeScreen`
      2. `LeaderboardScreen`
      3. `TwinComparisonScreen` (center raised Twin tab)
      4. `WeeklyReportScreen`
      5. `ProfileStack` (Profile + sub‑tabs)
    - **Pushed screens** layered on top of tabs:
      - `PaywallScreen`, `SettingsScreen`, `TwinChatScreen`, `RankCardScreen`, `JournalEditorScreen`.
  - From here, the core loops:
    - **Home** drives missions, XP, pet, and Twin strip.
    - **Twin Comparison** lets the user see the gap vs Twin.
    - **Weekly Report** surfaces Sunday weekly reports.
    - **Profile** shows (currently placeholder) stats, streaks, titles, and interests.
    - **Settings** allows some preferences and paywall preview.
    - **Journal** lets the user write daily entries backed by the backend journal API.

- **Backend side**
  - Every authenticated API call uses the Supabase JWT (`Authorization: Bearer ...`) and derives `user_id` from it.
  - Background cron endpoints (called by an external scheduler):
    - Planner agent: daily mission generation / difficulty adaptation.
    - Nudge agent: twice‑daily push nudges.
    - Weekly report agent: Sunday 3am report generation and push “teaser”.
    - Leaderboard refresh: periodic Power Score recomputation.

---

## 2. Screen-by-screen behaviour (mobile)

### 2.1 Root & global wiring

- **`App`**
  - Loads Inter fonts and shows a blocking loading spinner until ready.
  - Wraps the tree in `GestureHandlerRootView` and `NavigationContainer` with a dark nav theme.
  - Registers a Supabase `auth.onAuthStateChange` listener:
    - On `SIGNED_IN` / `TOKEN_REFRESHED`:
      - Registers for Expo push notifications, gets an Expo push token, and calls `patchUserMe` with `{ push_token, timezone }`.
    - On app foreground (`AppState` change to `"active"`):
      - If a session exists, calls `patchUserMe` with `{ last_opened_at }`.
  - Backend `GET /api/v1/user/me` and `PATCH /api/v1/user/me` are implemented in `routes/user.py`; patches for `push_token`, `timezone`, `last_opened_at`, and `nudge_frequency` succeed when the backend is available.

- **`RootStack`**
  - Stack navigator with:
    - `Splash` → `SplashScreen`
    - `SignUp` → `SignUpScreen`
    - `Onboarding` → `OnboardingStack`
    - `Main` → `MainStack`
  - All screens are headerless; root decides whether user should see onboarding vs main experience.

### 2.2 Splash & authentication

- **`SplashScreen`**
  - Renders the cinematic gradient (premium dark: `#05060C` → `#0A0C18` → `#06070E`), fracture line, two hooded figures, crack sparks (brighter/larger particles along the line), logo block, and tagline (“Same start. One kept their word.”).
  - Uses Reanimated for entrance and loop animations (particles, sparks, figure rise).
  - After **5000ms**, runs `navigation.replace("SignUp")`.

- **`SignUpScreen`**
  - Uses the **premium background gradient** (same as splash: `GRADIENTS.backgroundPremium`) for a consistent dark look until Main.
  - Shows the project branding, tagline, and three sign‑in CTAs:
    - `Continue with Apple`, `Continue with Google`, `Continue with Email`.
  - **OAuth flow**:
    - Uses `supabase.auth.signInWithOAuth` with proper redirect/deep link URIs.
    - `expo-web-browser` & `expo-auth-session` handle the external browser round‑trip.
  - **Email magic link flow**:
    - Opens a modal with an email text input and a “Send link” button.
    - Calls `supabase.auth.signInWithOtp`.
    - Shows inline error strip if Supabase returns an error.
  - **Post‑sign‑in bootstrap**:
    - After a valid `session` is available:
      - Checks whether the user already has a `users` row.
      - If not:
        - Inserts `users` with email and `trial_start_date`.
        - Inserts defaults:
          - `character_state` (stage 1, total_xp 0)
          - `pet_state` (stage 0, total_pet_food 0)
          - `twin_state` (twin_xp 0, twin_character_stage 1, twin_pet_stage 0, streak 0)
        - Navigates to `Onboarding`.
      - If yes:
        - Skips directly to `Main` (restoring a returning user into the tabbed flow).

### 2.3 Onboarding stack

- **`OnboardingFramingScreen`**
  - Thematic screen: **premium background gradient** (same as splash), subtle particles, copy about “We don’t count perfect days”.
  - Single CTA button (`PrimaryButton`) that pushes `OnboardingQuestion` with `questionIndex=0`.

- **`OnboardingQuestionScreen`**
  - Uses **premium background gradient** for consistency with splash/SignUp.
  - A single configurable screen that drives the whole questionnaire:
    - It reads metadata (prompt, type, options) from an `ONBOARDING_QUESTIONS` config.
  - Supported question types:
    - Single‑select chips (`OnboardingOptionCard`).
    - Multi‑select chips with “Something else” free‑text.
    - Slider (for daily available hours).
  - Uses `OnboardingAnswersContext` to:
    - Persist answers across screens.
    - Provide `getAnswer` / `updateAnswer` for inputs.
  - Navigation:
    - Back chevron animates to previous question.
    - Forward button:
      - Validates the answer.
      - If `index < last`:
        - Animates to the next question.
      - If `index == last`:
        - Assembles `OnboardingPayload`.
        - Fetches Supabase session token.
        - Calls `postOnboarding(payload, token)` → backend.
        - Stores `archetype_content` from response in context.
        - `replace("ArchetypeReveal")`.

- **`ArchetypeRevealScreen`**
  - **Premium background gradient** for pre‑Main consistency.
  - Two phases:
    1. “Processing” state – animated dots and copy like “Reading your answers…”.
    2. Reveal – archetype name, description, and first Twin line from backend.
  - Uses `archetypeContent` from context, which is only available after a successful onboarding POST.
  - CTA “Enter →” transitions to `TwinIntroductionScreen`.

- **`TwinIntroductionScreen`**
  - **Premium background gradient** for pre‑Main consistency.
  - Visualizes the rivalry:
    - Left side “You”, right side “Your Twin one week ahead”.
    - Fracture line, short copy about the 14‑day learning window.
    - Twin first line from archetype data or a default.
  - **Begin** button:
    - Performs a navigation reset so that the root stack now only contains `Main`.
    - From this point, the user is in the daily usage loop.

### 2.4 MainStack and tabs

- **`MainStack`**
  - Native stack configured with `headerShown: false`.
  - Screens:
    - `MainTabs` → `MainTabNavigator`.
    - `Paywall` → `PaywallScreen`.
    - `Settings` → `SettingsScreen`.
    - `SettingsProfile` → `SettingsProfileScreen`.
    - `TwinChat` → `TwinChatScreen`.
    - `RankCard` → `RankCardScreen`.
    - `JournalEditor` → `JournalEditorScreen`.

- **`MainTabNavigator` + `CustomTabBar`**
  - Tabs:
    1. `Home` → `HomeScreen`
    2. `Leaderboard` → `LeaderboardScreen`
    3. `Twin` → `TwinComparisonScreen` (raised circular center button)
    4. `Report` → `WeeklyReportScreen`
    5. `Profile` → `ProfileStack`
  - Custom bottom bar:
    - Dark glass background with blur, border at top.
    - Icons + labels, with violet active tint and grey inactive states.
    - Center Twin button lifted above the bar with violet glow.

- **`ProfileStack`**
  - Secondary stack inside tab:
    - `ProfileMain` → `ProfileScreen`
    - `ProfileStats` → `ProfileStatsScreen`
    - `ProfileStreak` → `ProfileStreakScreen`
    - `ProfileTitles` → `ProfileTitlesScreen`
    - `ProfileInterests` → `ProfileInterestsScreen`

### 2.5 Home screen and missions flow

- **`HomeScreen` – what the user sees**
  - Top:
    - `TopBar` with username, stage title, and power score (currently wired with placeholder name / score).
  - Hero zone:
    - Character placeholder representing current stage.
    - Pet placeholder:
      - If `pet_state.stage >= 1`, `PetRoaming` renders a roaming pet across the entire Home screen.
      - Pet reacts on tap and occasionally moves.
    - `XPProgressBar` showing progress within the current character stage.
  - Twin strip:
    - `TwinAlertStrip` at top of content area.
    - Shows the latest `twin_strip_message` from backend.
    - Tapping strip navigates to the Twin tab (`TwinComparisonScreen`).
  - Sections:
    - **Header text**:
      - If 0 missions completed today: `"Start anywhere."`.
      - After first completion: `"Today's Missions"`.
      - Day 1–14 logic is approximated using AsyncStorage.
    - **Core**:
      - Section header with `SectionProgressRing` showing how many of today’s Core missions are complete.
      - List of `MissionCard`s for missions with `type="core"`.
    - **Today’s Focus (Interest)**:
      - Section header with ring.
      - Inline schedule chip that opens `InterestSchedulePickerModal` (local schedule only).
      - List of `MissionCard`s for missions with `type="interest"`.
    - **Personal**:
      - Section header with ring.
      - “+ Add mission” chip that opens `AddMissionModal`.
      - List of `MissionCard`s for missions with `type="personal"`.
  - FAB:
    - Floating action button in the bottom‑right that navigates to `JournalEditorScreen`.
  - Overlays:
    - `AddMissionModal` – creating new personal missions.
    - `InterestSchedulePickerModal` – editing local interest schedule.
    - `CharacterEvolutionOverlay` – shown when `character_state.stage` increments.
    - `MilestoneAchievementCard` – shown when interest milestones are earned.

- **`HomeScreen` – data + behaviour**
  - On focus / pull‑to‑refresh:
    - Uses Supabase’s current session to get the JWT.
    - Calls `getHome(token)`:
      - Backend returns `character_state`, `pet_state`, today’s `missions`, `twin_strip_message`, optionally `username` and `power_score`.
    - State is split into:
      - `coreMissions`, `interestMissions`, `personalMissions`.
      - `characterState`, `petState`.
      - `twinStripMessage`.
  - Completing a mission:
    - `MissionCard` exposes `onComplete` callback, wired to `handleCompleteMission`.
    - The handler:
      - Marks the mission as `completed` in local state.
      - Calls `completeMission(token, missionId)` → `POST /missions/{id}/complete`.
      - Backend:
        - Validates the mission.
        - Computes XP/PF gain and updates `character_state`, `pet_state`, `streak_log`, `interest_progress`, and maybe `milestone_log`.
        - Returns a payload containing:
          - Updated `character_state` / `pet_state`.
          - Updated mission object.
          - Optional `earned_milestone` and flags for stage/pet stage up.
          - New `twin_strip_message` when all today’s missions are done.
      - The app merges updated mission and state.
      - If `earned_milestone` is present:
        - Shows `MilestoneAchievementCard` overlay with interest name and Twin congratulation.
      - If character or pet stage increased:
        - Triggers `CharacterEvolutionOverlay` (character) and adjusts pet visuals.
  - Adding a personal mission:
    - `AddMissionModal`:
      - `onSuggestTier(title)` calls `estimatePersonalTier(token, title)`:
        - Backend uses GPT to infer difficulty and XP/PF tier.
      - `onAdd(title, difficulty)` calls `createMission(token, { title, difficulty, type: "personal" })`.
      - On success, the new mission is appended to `personalMissions`.

### 2.6 Twin comparison and chat

- **`TwinComparisonScreen`**
  - Shows a split card:
    - Left: your character/pet with XP, Power Score, streak.
    - Right: Twin’s character/pet with their numbers.
    - A central fracture line and copy describing the gap.
  - On mount or focus:
    - Fetches `getTwinComparison(token)` → `GET /twin/comparison`.
    - Backend:
      - Simulates Twin progression since last update:
        - Applies daily XP and pet food increments based on discipline_dna and consistency ceiling.
        - Updates `twin_state` row in DB.
      - Computes gap state (`AHEAD`, `CLOSING`, `MATCHED`, `PASSED`) and approximate `gap_days`.
      - Builds `gap_line` and `strip_message`.
    - Screen displays:
      - XP vs XP, pet vs pet, streak vs streak, plus copy about the gap.
  - CTA:
    - “Talk to your Twin” navigates to `TwinChatScreen`.

- **`TwinChatScreen`**
  - UI:
    - Header with Twin avatar placeholder and stage.
    - Inverted chat list of bubbles.
    - Typing indicator and tone rating controls below last Twin message.
    - Input area with text field and send button.
  - Behaviour (current state):
    - Uses a small local placeholder messages array.
    - On send:
      - Appends the user’s message.
      - After a delay, appends a canned Twin reply `"That won't make you stronger."`.
  - **Not yet integrated**:
    - There is **no call** to backend `/twin/chat`, even though the backend Twin Chat agent and `twin_chat` table are implemented.
    - Tone ratings are not persisted.

### 2.7 Leaderboard and weekly report

- **`LeaderboardScreen`**
  - Renders:
    - A header “Leaderboard”.
    - A “Your Rank” hero card.
    - A list of `LeaderboardRowCard` entries.
  - Implementation detail:
    - On focus, calls `getLeaderboard(token)` → `GET /api/v1/leaderboard`.
    - Shows loading skeleton, then entries from `LeaderboardOut.entries`; empty state when no entries or user not yet on leaderboard.
    - “Visible after 7 consecutive days” is enforced by the backend (user appears in `leaderboard_scores` when eligible).
  - Interactions:
    - Tapping “Share your rank” navigates to `RankCardScreen`.

- **`WeeklyReportScreen`**
  - When entered:
    - Attempts `getWeeklyReport(token)` → `GET /agents/weekly-report`.
    - Shows:
      - Loading spinner.
      - Error state on failure (Retry button).
      - Empty state if no reports.
    - For a fetched report:
      - Maps `WeeklyReportRow` into a `ReportData` structure consumed by `ReportCard`.
  - Main list view:
    - “This Week” card summarizing XP, streak, completion, Twin message, and “Next Week” guidance.
    - “Past Reports” list – taps open a detail view.
  - Detail view:
    - Shows a single past `ReportCard` with a back header and a “Return” button to go back to list.
  - Data:
    - Leverages backend’s stored `weekly_reports` table; no LLM calls on client.
    - If the backend included day‑of‑week completion in `this_week_data`, `DayOfWeekChart` uses it; otherwise, defaults.

### 2.8 Profile stack

**Important**: All profile‑area screens currently use placeholder data. They are the main gap between spec and reality.

- **`ProfileScreen`**
  - Hero:
    - Hard‑coded username, stage title, pet stage, and `XPProgressBar`.
  - “Power Score” and a “Share rank card” CTA (navigates to `RankCardScreen`).
  - Four navigation tiles:
    - Stats → `ProfileStatsScreen`.
    - Streak → `ProfileStreakScreen`.
    - Titles → `ProfileTitlesScreen`.
    - Interests → `ProfileInterestsScreen`.

- **`ProfileStatsScreen`**
  - Charts:
    - XP over time.
    - Weekly completion.
    - Twin gap trend.
    - Interest progress bars.
  - All chart data is generated in the component via simple arrays; nothing is fetched from backend.
  - Does not call `/analytics/day-of-week` or other analytics endpoints yet.

- **`ProfileStreakScreen`**
  - Shows:
    - Current streak and longest streak (placeholder numbers).
    - `StreakHeatmap` with generated data for 52 weeks.
    - “This month” stats card with static days active.
  - `StreakHeatmap` exposes tap handlers, but the screen does not wire `DayDetailModal`; taps currently do nothing.
  - No use of `streak_log` or server stats.

- **`ProfileTitlesScreen`**
  - Displays:
    - Hero card with current character stage and `XPProgressBar` toward next.
    - List of all stages with locked/unlocked badges and blur overlays.
  - Uses a hard‑coded XP total and thresholds that differ from backend `STAGE_THRESHOLDS`.
  - Intended to mirror character evolution but not yet data‑driven.

- **`ProfileInterestsScreen`**
  - Shows:
    - Header with back, “Interests” title, and **three‑dots menu** (top right). Menu option: “Delete an interest” → enters **delete mode** (no trash icon on each row).
    - “Your Interests” list: each block has name, level badge (1–10; golden ring at 10), XP bar, active days, and **per‑interest “MILESTONES”** section with 7 **`MilestoneRow`**s (locked/unlocked). Tapping an **unlocked** row opens **`MilestoneCardScreen`** (full‑screen modal with soul line, stats, Share button).
    - “+ Add Interest” button opening add‑interest flow.
    - **Delete mode**: three‑dots → “Delete an interest” → selection circles on each row; tap row to toggle; bottom bar “Cancel” / “Delete (N)”; confirm Alert before remove.
  - Data: interests from `getInterests` (or `PLACEHOLDER_INTERESTS`); each interest has optional `milestones` array (`InterestMilestone[]`). Phase 1 uses `PLACEHOLDER_MILESTONES` per interest.
  - **MilestoneCardScreen**: full‑screen modal per milestone (M1–M7), with soul line, stats layout by type, date stamp, **Share** button (scrollable so Share is visible).
  - **M2 milestone card**: stats row order is Sessions | **Day Streak** (middle) | XP Total; then 7‑cell heatmap.

### 2.9 Settings, journal, rank card, paywall

- **`SettingsScreen`**
  - Rows:
    - **Profile** → navigates to **`SettingsProfile`** (sub-label: “Edit your information”). Navigation uses `navigation.navigate("SettingsProfile")` (with fallback to `getParent()` if needed).
    - Notifications (opens OS notification settings).
    - Notification Frequency (segmented control in AsyncStorage; not synced to backend `users.nudge_frequency`).
    - Streak Freezes (display only).
    - Twin Tone History (opens `ToneHistoryModal` with static sample entries).
    - Subscription (navigates to `PaywallScreen`).
    - **Log out** – full‑width **primary-style gradient button** (same as app CTAs), 52px height; signs out via Supabase and resets nav to SignUp.
  - No longer: Anonymous Mode row, Delete Account row, Preview Milestone Card row (milestone preview lives in Profile → Interests).

- **`JournalEditorScreen`**
  - Calendar at top and text area beneath.
  - On mount:
    - Calls `getJournalEntries(token)` → `GET /journal` and populates `entriesByDate`.
  - Saving:
    - Calls `saveJournal(token, { date, content })` → `POST /journal`.
    - Locks entry for the day to read‑only unless user taps `Edit`.
  - All journal state is backed by the `journal_entries` table on backend.

- **`RankCardScreen`**
  - Visual rank card view focused on sharing:
    - Character + pet visuals (placeholder).
    - Power Score, streak, username (placeholder values).
    - Oracle line text, editable via a modal.
  - Buttons:
    - “Share Rank Card” – currently logs to console; intended to use view‑shot and platform share sheet.
    - “Regenerate Oracle line” – currently logs; intended to call `/agents/oracle-line`.

- **`SettingsProfileScreen`**
  - Reached from Settings → Profile row.
  - Header: back + “Profile” title.
  - Content: single line **“Edit your information”** (placeholder for future avatar, username, email, etc.). No delete-account or full form in current build.

- **`PaywallScreen`**
  - **Premium layout** (dark gradient `GRADIENTS.backgroundPremium`): Restore (top left), logo icon (centre), headline (“Invest in yourself and achieve your true potential in 66 days.”).
  - **Timeline**: three steps with violet icon circles and connector line (Today – unlock features; In 5 Days – reminder; In 7 Days – billing starts).
  - **Plan cards**: two side‑by‑side – **MONTHLY** ($12.99/mo) and **YEARLY** (7 DAYS FREE badge, strikethrough $12.99/mo, $4.16/mo, selected by default). Radio-style selection; selected card has violet border and checkmark.
  - “No Payment Due Now” with checkmark; full‑width CTA **“Start My 7-Day Free Trial”** (gradient button); footer “7 days free, then $49.99 per year ($0.13 per day)” and Terms of Use | Privacy Policy links.
  - Logic: handlers log; no RevenueCat yet. Shown when navigating from Settings or manual routing.

---

## 3. Backend routes and behaviour

### 3.1 Main FastAPI app

- **`main.py`**
  - Creates `FastAPI` with CORS for all origins.
  - Includes routers under `/api/v1`:
    - `auth`, `onboarding`, `missions`, `home`, `twin`, `leaderboard`, `agents`, `user`, `analytics`, `journal`.
  - Health check at `/health`.
  - Reads Supabase service key and JWT secret from environment, initializes a Supabase service client.

### 3.2 Auth and onboarding

- **Auth**
  - `utils.auth.get_user_id`:
    - Decodes Supabase JWT from `Authorization: Bearer` header using `SUPABASE_JWT_SECRET`.
    - Returns `user_id` for use in all routes.
  - `routes/auth.py`:
    - Provides an `@app.get("/auth/me")` helper for debugging and local testing.

- **`POST /api/v1/onboarding`**
  - Request: `OnboardingPayload` with:
    - `answers` (dict keyed by question id).
    - `interests`, `quit_targets`, `available_hours_per_day`, `gender`.
  - Flow:
    - `score_archetype(answers)`:
      - Chooses an archetype and builds `discipline_dna` (tone_type, intensity, etc.) using GPT via LangGraph Profiler agent.
    - Upserts `users`:
      - Sets archetype, discipline_dna, interests, quit_targets, gender, trial_start_date, subscription_status `"trial"`.
    - Ensures `character_state`, `pet_state`, `twin_state` records exist.
    - Runs `generate_initial_missions`:
      - Uses Planner agent to craft initial Core + Interest + Escaper missions.
      - Inserts them into `missions`.
    - Responds with:
      - `archetype_content` for frontend reveal.
      - The created missions for reference (frontend currently ignores them and reloads `/home` instead).

### 3.3 Home and missions

- **`GET /api/v1/home`**
  - Derives `user_id` from token.
  - Fetches:
    - `character_state` row.
      - Uses `STAGE_THRESHOLDS` to infer `next_stage_xp` and `next_stage_name`.
    - `pet_state` row.
    - Today’s `missions`:
      - `expires_at` between today’s 00:00 and 23:59:59 UTC.
    - `twin_state.strip_message` (latest Twin strip text).
    - Optionally `leaderboard_scores.power_score` and `users.email` (to derive a username).
  - Returns `HomeOut` which Home screen consumes.

- **`/api/v1/missions`**
  - `GET`:
    - Returns all missions for the user (sorted by created_at).
  - `POST`:
    - Accepts `MissionCreate` (type, pillar/interest, title, difficulty).
    - Uses `xp_and_pf_for(type, difficulty)` to compute XP and Pet Food.
    - Sets `expires_at` to end of current day for personal missions (others may be set by Planner).
    - Inserts mission and returns it as `MissionOut`.
  - `PATCH /missions/{id}`:
    - Generic updater for missions the Planner or client may adjust.
  - `POST /missions/{id}/complete`:
    - Guards:
      - Mission must belong to user.
      - Not already completed.
    - Applies:
      - Character XP increment → updates `character_state.total_xp` and stage.
      - Pet Food increment → updates `pet_state.total_pet_food` and `stage` via thresholds.
      - `streak_log`:
        - Ensures a row for today.
        - Increments `core_completed` for core missions.
        - Updates `completion_level` (0–4) based on # of core missions completed.
      - `interest_progress`:
        - For interest missions, increments `session_count` and `total_xp`, and updates `level` using interest thresholds.
        - Calls `check_and_award_milestones` to maybe insert a row in `milestone_log`.
      - `twin_state.strip_message`:
        - When all of today’s missions are complete, sets a short congratulatory strip message.
    - Returns `MissionCompleteOut` including:
      - Updated mission and state.
      - Optional `earned_milestone`.

### 3.4 Twin comparison and chat

- **`GET /api/v1/twin/comparison`**
  - Reads:
    - User discipline_dna and archetype from `users`.
    - `character_state.total_xp`.
    - `pet_state.stage` and `total_pet_food`.
    - `leaderboard_scores.streak` and `power_score` (if any).
    - `twin_state` row:
      - `twin_xp`, `twin_pet_stage`, `twin_pet_food`, `streak`, `gap_state`, `strip_message`, `consistency_ceiling`, `last_updated`.
  - Simulates Twin progression:
    - For each day from `last_updated` to today:
      - Computes daily Twin XP and PF based on `consistency_ceiling_for`.
      - Updates cumulative `twin_xp`, `twin_pet_food`, `twin_pet_stage`.
  - Computes:
    - `gap_state` (AHEAD, MATCHED, CLOSING, PASSED).
    - `gap_days` as an approximate days‑behind metric based on XP gap and daily XP gain.
    - `gap_line` – human‑readable comparison message.
  - Writes updated `twin_state` and returns `TwinComparisonOut`.

- **`POST /api/v1/twin/chat`**
  - Receives `TwinChatRequest { content }`.
  - Context gathering:
    - User archetype, discipline_dna, and email.
    - `twin_state` (xp, gap_state, pet_stage, etc.).
    - `character_state.total_xp`.
    - `leaderboard_scores.streak`.
    - Last missed mission type and other mission patterns.
    - Last N `twin_chat` messages (for conversation memory and anti‑repetition).
  - Calls Twin agent:
    - `agents.twin_agent.generate_twin_reply` with prompt wiring as per CLAUDE spec.
    - Returns text reply + `tone_rating`.
  - Persists:
    - New `twin_chat` rows for the user message and the Twin response.
  - Responds with `TwinChatResponse` used by the client (once integrated).

### 3.5 Planner, Profiler, Nudge, Weekly Report agents

- **Profiler (`/agents/profile`)**
  - Given onboarding answers and optional behaviour stats:
    - Runs GPT‑based Profiler agent via LangGraph.
    - Produces `discipline_dna` JSON describing tone, intensity, gap behaviour, challenge level, and nudge preferences.
    - Updates `users.discipline_dna`.

- **Planner (`/agents/plan`)**
  - Intended to run nightly via cron.
  - Steps:
    - `run_difficulty_adaptation(user_id)`:
      - Looks at completion history and adjusts difficulty for future missions.
    - `plan_interest_and_escaper_missions(user_id, interests, quit_targets)`:
      - For each interest, uses GPT to generate missions with XP tiers.
      - For each quit target, generates “escaper” replacement behaviour missions.
      - Inserts `interest` and `recovery` missions into `missions` with appropriate difficulty and XP/PF values.

- **Nudge (`/agents/nudge` and `/agents/nudge/run`)**
  - Nudge pass:
    - Pulls `users` with non‑null `push_token`.
    - For each user:
      - Checks local time window and last opened time.
      - Computes highest‑priority nudge type that applies:
        - Streak warning, re‑engagement, pet nudge, milestone approaching, momentum.
      - Feeds streak, pet, and recent `nudge_log` records into GPT‑4o‑mini with strong anti‑guilt and anti‑repetition rules.
      - Sends push via Expo push API and logs into `nudge_log`.
  - User‑specific nudge endpoint (`POST /agents/nudge`) exists for targeted testing of the logic.

- **Weekly Report (`/agents/weekly-report`)**
  - Cron `run` endpoint:
    - For each user:
      - Assembles last week’s stats from `missions`, `streak_log`, `character_state`, `pet_state`, and `twin_state`.
      - Includes previous 2 weeks of report text for anti‑repetition.
      - Calls GPT‑4o‑mini Weekly Report agent to produce:
        - `wins[]`, `slipped[]`, `keep_watching`, `twin_paragraph`, `twin_closing`, `next_week`.
      - Inserts into `weekly_reports` with `week_start` and `this_week_data`.
      - Triggers a nudge to let user know their report is ready.
  - Client‑facing `GET /agents/weekly-report`:
    - Returns at most 2 most recent reports for use in `WeeklyReportScreen`.

### 3.6 Leaderboard, analytics, journal

- **`GET /api/v1/leaderboard`**
  - Returns:
    - `entries` – top 100 users by `leaderboard_scores.power_score` with associated stages, pet stages, and streaks.
    - `my_entry` and `my_rank` for current user if they aren’t in top 100.
  - Combines with `refresh_leaderboard_scores` background job:
    - Recomputes Power Score using:
      - Normalized XP stage %, pet stage, streak (capped at 30 days), and weekly completion.

- **`GET /api/v1/analytics/day-of-week`**
  - Aggregates user streak/completion data by weekday:
    - Uses `streak_log` and mission completion.
  - Returns a map of `mon..sun` to completion percentages.

- **Journal (`/api/v1/journal`)**
  - `POST`:
    - Inserts or updates a `journal_entries` row for a given date.
  - `GET`:
    - Returns entries filtered by optional `from`, `to`, or `limit` parameters.
  - Backed by Supabase; used by `JournalEditorScreen`.

---

## 4. Component catalogue (mobile)

This section lists the key reusable components and what they do for the user.

- **`PrimaryButton`**
  - Standard filled CTA with gradient and Reanimated press feedback.
  - Used on onboarding CTAs, paywall, Home FAB overlays, etc.

- **`TopBar`**
  - Glass top bar showing username, stage title, and Power Score.
  - Appears on `HomeScreen`.

- **`XPProgressBar`**
  - Horizontal bar showing XP progress between current and next character stage.
  - Animates fills and supports callback when 100% reached.
  - Used on Home hero and Profile Titles hero.

- **`TwinAlertStrip`**
  - Thin strip summarizing the latest Twin strip message and whether there’s “new” content.
  - Pulses using Reanimated when `hasNewMessage=true`.
  - Tapping navigates to the Twin comparison tab.

- **`PetAnimation`**
  - Circular gradient pet avatar with subtle scaling animation for “breathing”.
  - Stands in for full MP4 pet animations for now.
  - Used on comparison, profile, rank card, and paywall.

- **`PetRoaming`**
  - Roaming pet overlay for `HomeScreen`.
  - Implements a simple state machine:
    - Idle → move to a random location → pause → maybe react on tap → return to hero.
  - Respects nav bar exclusion and edge exclusion zones.

- **`MissionCard`**
  - Central unit in mission system:
    - Shows title, type (core/interest/personal), difficulty, XP, Pet Food.
    - Edge color and chips reflect mission type and difficulty.
    - Displays 🔥 streak when mission_streak ≥ 2 for core/interest.
  - Interactions:
    - Swipe right to complete when `status="pending"`.
    - Tap when `onPress` is provided (used for journal or multi‑day missions in future).

- **`SectionProgressRing`**
  - 32px ring representing progress (completed/total) for a section.
  - Variant drives color (core vs interest vs personal).

- **`AddMissionModal`**
  - Bottom sheet used to add personal missions on Home.
  - Supports optional “Suggest tier” via backend LLM.

- **`AddInterestModal`**
  - Simple modal for adding a new interest in Profile.
  - Currently only affects local state.

- **`InterestSchedulePickerModal`**
  - Modal for selecting weekdays for an interest.
  - Used on Home’s Today’s Focus schedule chip and Profile Interests.

- **`LeaderboardRowCard`**
  - Shows rank number, username, stage, pet icon, streak, and Power Score.
  - Special styling for top 3 and “own” row.
  - Currently fed by placeholder data.

- **`StreakHeatmap`**
  - 365‑day heatmap grid of activity.
  - Intended for Profile Streak tab; currently filled with fake data.

- **`MilestoneAchievementCard`**
  - Full‑screen overlay celebrating interest milestones.
  - Triggered after `EarnedMilestoneOut` from backend.

- **`MilestoneRow`**
  - Compact row for Profile → Interests: locked (dim, hint text, 🔒) or unlocked (violet edge, meta line, chevron). M7 unlocked uses gold accent. Tap unlocked row opens `MilestoneCardScreen`. Uses `MILESTONE_DEFINITIONS` and `InterestMilestone` from `constants/milestoneDefinitions.ts`.

- **`MilestoneCardScreen`**
  - Full‑screen modal for an earned milestone: per‑milestone card style (M1–M7), soul line, stats (layout varies by milestone), date stamp, **Share** button. Scrollable so Share is always visible. M2 stats: Sessions | Day Streak (middle) | XP Total + heatmap.

- **Onboarding components**
  - `OnboardingProgressBar` – 1–10 progress with thin violet bar.
  - `OnboardingOptionCard` – selectable chip used for answers.
  - `OnboardingSlider` – slider input for available hours per day.

- **Miscellaneous**
  - `SecondaryButton` – outlined / secondary style button.
  - `ToneHistoryModal` – modal listing historical Twin tone changes (static placeholder).
  - `WhatWeLearnedModal` – modal for “What we learned about you” at day 14 (not yet wired).

---

## 5. Major gaps and next steps

This section summarizes where the current implementation diverges from the CLAUDE.md spec so you know which parts are “real” versus placeholder.

- **Twin Chat not wired**
  - Backend Twin Chat agent is fully implemented.
  - `TwinChatScreen` does not call `/twin/chat` or persist chat messages.

- **Profile area is placeholder**
  - Stats, streak, titles, and interests tabs do not read from:
    - `character_state`, `streak_log`, `interest_progress`, `milestone_log`, or `leaderboard_scores`.
  - XP thresholds used in `ProfileTitlesScreen` conflict with backend thresholds.

- **Nudge frequency and settings sync**
  - Settings screen’s nudge frequency only updates AsyncStorage.
  - Backend uses `users.nudge_frequency` to adjust nudge cadence; these two are not synced.

- **Paywall & subscription**
  - `PaywallScreen` has full UI but no RevenueCat or billing integration.
  - Trial vs subscribed logic is not enforced in navigation.

- **Pet & character animations**
  - `PetAnimation` and character visuals are placeholders, not the MP4 clips described in the spec.

- **“What we learned about you”**
  - Modal exists on client, but there is no flow to show it at Day 14 with a summary from Profiler/Weekly Report.

As you evolve the app, you can treat this document as the ground truth of what’s wired today. When adding new flows, mirror the patterns used here (Supabase auth, backend JWT, NativeWind + gradients, Reanimated transitions) and keep server‑side business logic as the single source of truth for XP, streaks, Twin gap, and Power Score.

---

## 6. Mock API (UI preview without backend)

To check all UI without hitting the real backend (no network errors, no backend required):

1. **Enable mock mode**  
   In `alter-ego-mobile/.env` add:
   ```bash
   EXPO_PUBLIC_USE_MOCK_API=true
   ```
2. **Restart Expo** (so the env is picked up):
   ```bash
   npx expo start --clear
   ```
3. Use the app as usual. All backend API calls (home, leaderboard, twin comparison, weekly report, user/me, missions, journal, onboarding POST, etc.) return in-memory mock data. Auth still uses Supabase, so you can sign in or use "Sign in later" and then navigate every screen with mock data.

**Revert to real backend**

- Remove the line `EXPO_PUBLIC_USE_MOCK_API=true` from `.env`, or set it to `false`.
- Restart Expo (`npx expo start --clear`).

Mock logic lives in `alter-ego-mobile/src/utils/apiMock.ts`; `api.ts` branches on the flag and delegates to the mock when set.

---

## 7. Recent changes and affected files

This section records notable changes and the exact files/lines affected so you can trace or revert them.

### 7.1 Mock API (UI preview without backend)

| Change | Location | Details |
|--------|----------|---------|
| Env flag and mock wiring | `alter-ego-mobile/src/utils/api.ts` | **Lines 1–16**: Comment block updated; `USE_MOCK` and `apiMock` require(). **Lines 51, 68, 143, 158, 180, 206, 248, 279, 294, 331, 381, 396, 419, 449–450**: First line of each API function branches with `if (apiMock) return apiMock.<fn>(...)`. |
| Mock implementations | `alter-ego-mobile/src/utils/apiMock.ts` | **New file** (~320 lines). Exports mock implementations for: `checkUsername`, `postOnboarding`, `getHome`, `completeMission`, `estimatePersonalTier`, `createMission`, `getTwinComparison`, `getUserMe`, `patchUserMe`, `getLeaderboard`, `getWeeklyReport`, `getDayOfWeekCompletion`, `saveJournal`, `getJournalEntries`. All return in-memory data matching existing API types. |
| Env variable | `alter-ego-mobile/.env` | Optional line: `EXPO_PUBLIC_USE_MOCK_API=true`. When set, all backend API calls use mocks. Remove or set to `false` to revert to real backend. |
| Documentation | `PROJECT_WORKFLOW.md` | **§6** (lines ~740–758): How to enable/disable mock mode and revert. **§7**: This changelog. |

### 7.2 Backend wiring (current state)

These screens and flows are wired to the real backend (and to mocks when `EXPO_PUBLIC_USE_MOCK_API=true`):

| Screen / flow | API used | Backend route | Mobile file (relevant lines) |
|---------------|----------|---------------|------------------------------|
| Home | `getHome`, `completeMission`, `createMission`, `estimatePersonalTier` | `GET /home`, `POST /missions/{id}/complete`, `POST /missions`, `POST /missions/estimate-personal-tier` | `HomeScreen.tsx` (e.g. 32, 128, mission handlers) |
| Leaderboard | `getLeaderboard` | `GET /leaderboard` | `LeaderboardScreen.tsx` (23, 74–76) |
| Twin Comparison | `getTwinComparison` | `GET /twin/comparison` | `TwinComparisonScreen.tsx` (22, 68) |
| Weekly Report | `getWeeklyReport` | `GET /agents/weekly-report` | `WeeklyReportScreen.tsx` (28, 481) |
| Profile (header) | `getUserMe`, `getHome` | `GET /user/me`, `GET /home` | `ProfileScreen.tsx` (17, 64–65) |
| App (session) | `patchUserMe` | `PATCH /user/me` | `App.tsx` (push_token, timezone, last_opened_at) |

Backend routes: `alter-ego-backend/main.py` includes `user` router (line 4, 24). `alter-ego-backend/routes/user.py` implements `GET /user/me` and `PATCH /user/me`.

### 7.3 Updates to this document (Project Workflow)

| Section | Change |
|---------|--------|
| **§2.1 App** | Replaced “user/me does not exist” with note that GET/PATCH `/api/v1/user/me` are implemented in `routes/user.py`. |
| **§2.7 LeaderboardScreen** | Replaced placeholder/“does not call backend” with: calls `getLeaderboard`, shows loading/empty/error; 7-day visibility from backend. |
| **§3.1 Main FastAPI app** | Router list: “intended user” → “user” (route is included). |
| **§5 Major gaps** | Removed “Missing `/user/me` route” and “Leaderboard not connected”; kept Twin Chat, Profile placeholder, nudge sync, paywall, animations, “What we learned”. |
| **§6** | Added Mock API (UI preview) instructions. |
| **§7** | Added this “Recent changes and affected files” section. |

### 7.4 Onboarding, journal, interests, and planner updates (this session)

| Area | Change | Files |
|------|--------|-------|
| Onboarding flow | Inserted `Onboarding14DayScreen` between Archetype reveal and Twin intro. It shows animated 14‑day copy (“Your first 14 days we learn how you work best. Work at your own pace and in your own style.”) plus a short privacy line before continuing to Twin. | `alter-ego-mobile/src/screens/Onboarding14DayScreen.tsx`, `src/navigation/OnboardingStack.tsx`, `src/navigation/types.ts`, `src/screens/ArchetypeRevealScreen.tsx` (navigation + particle background + minimum processing duration). |
| Archetype processing screen | The “Reading your answers / Building your Discipline DNA…” screen now uses a rotating dot ring (same visual as later phase) and enforces a **minimum display time** before reveal, even if `/onboarding` returns instantly. | `alter-ego-mobile/src/screens/ArchetypeRevealScreen.tsx`. |
| Daily journal mission | Journaling is now a **permanent daily Interest mission**: Planner always inserts an `interest="Journal"` mission titled “Write today's journal entry.” (Easy difficulty) on both Day 1 and in nightly plans, skipping duplicates if one already exists. | `alter-ego-backend/agents/planner.py`, `alter-ego-backend/agents/planner_agent.py`. |
| Home – Today’s Focus | Home no longer exposes an inline **Schedule** chip or `InterestSchedulePickerModal`. Today’s Focus is just the interest list (which now always includes the daily Journal mission), and schedule editing has moved to Profile → Interests. | `alter-ego-mobile/src/screens/HomeScreen.tsx`. |
| Profile → Titles | Locked titles no longer overlay the text; the lock icon now sits at the **end of the row** beside the title, with a softer opacity on locked rows for readability. | `alter-ego-mobile/src/screens/ProfileTitlesScreen.tsx`. |
| Profile → Interests (data) | Interests list is no longer purely local placeholder; it now hydrates from backend `interest_progress` via `GET /api/v1/interests` (or mock equivalent). Each row shows name, L1–L10 badge, XP bar, and active days derived from persisted `schedule`. | `alter-ego-mobile/src/screens/ProfileInterestsScreen.tsx`, `alter-ego-mobile/src/utils/api.ts`, `alter-ego-mobile/src/utils/apiMock.ts`, `alter-ego-backend/routes/interests.py`, `alter-ego-backend/main.py`. |
| Profile → Interests (add / edit) | Adding an interest in Profile now reuses the **4‑step onboarding add‑interest flow** (name → level → goal → schedule). Tapping an existing interest opens an **Edit Interest** modal that lets the user re‑edit steps 2–4 (level, goal, schedule). Long‑press still removes. | `alter-ego-mobile/src/components/AddInterestOnboardingModal.tsx`, `src/components/EditInterestDetailsModal.tsx`, `src/screens/ProfileInterestsScreen.tsx`. |
| Planner input (interests) | Onboarding now persists per‑interest `level`, `learning_goal`, and `schedule` into `interest_progress` (when the DB has those optional columns). Planner uses this metadata when generating missions (Level/Goal in the prompt, and `schedule` to decide which days to create missions). | `alter-ego-backend/models/onboarding.py`, `alter-ego-backend/routes/onboarding.py`, `alter-ego-backend/agents/planner_agent.py`, `alter-ego-mobile/src/utils/api.ts`. |
| New backend router | Added `GET /api/v1/interests` and `PATCH /api/v1/interests/{interest}` for per‑interest metadata (goal/level/schedule). Planner and Profile → Interests both rely on this when the DB schema includes the optional columns. | `alter-ego-backend/routes/interests.py`, `alter-ego-backend/main.py`. |
| Outstanding migration notes | To fully persist per‑interest goal/level/schedule, the Supabase `interest_progress` table needs new columns. The schema file includes commented migrations: `self_level text`, `learning_goal text`, `schedule int[]`. Without these, edits from Profile still work in UI and Planner falls back gracefully, but the extra metadata is not stored server‑side. | `alter-ego-backend/supabase/schema.sql` (comments under **11. INTEREST_PROGRESS**). |

### 7.5 Splash, backgrounds, milestones, Interests delete, Settings, Paywall (UI pass)

| Change | Location | Details |
|--------|----------|---------|
| **Splash – crack sparks** | `alter-ego-mobile/src/screens/SplashScreen.tsx` | Sparks made **brighter and larger**: size 2px→4px (small 1.5→3), color/opacity and shadow (`#D7AAFF`, shadowRadius 8) increased. Spark positions adjusted for new sizes. |
| **Splash – auto-navigate delay** | `alter-ego-mobile/src/screens/SplashScreen.tsx` | Navigate to SignUp after **5000ms** (was 2800ms). |
| **Premium background (pre‑Main)** | `alter-ego-mobile/src/constants/theme.ts` | Added **`GRADIENTS.backgroundPremium`**: `#05060C` → `#0A0C18` → `#06070E` (same as splash). |
| **Premium background usage** | `alter-ego-mobile/src/screens/SignUpScreen.tsx`, `OnboardingFramingScreen.tsx`, `OnboardingQuestionScreen.tsx`, `ArchetypeRevealScreen.tsx`, `Onboarding14DayScreen.tsx`, `TwinIntroductionScreen.tsx`, `src/navigation/OnboardingStack.tsx` | SignUp + all Onboarding screens use `GRADIENTS.backgroundPremium`; OnboardingStack `contentStyle` uses `#05060C`. |
| **M2 milestone – streak in middle** | `alter-ego-mobile/src/components/MilestoneCardScreen.tsx` | Stats row for M2 reordered to **Sessions \| Day Streak \| XP Total** (streak in centre). |
| **Milestone card – Share visible** | `alter-ego-mobile/src/components/MilestoneCardScreen.tsx` | Scroll content `paddingBottom: 48`, `flexGrow: 1`; card `paddingBottom: 24`; Share button wrapped in `shareBtnWrap` so it remains visible when scrolling to bottom. |
| **Interests – three‑dots, delete flow** | `alter-ego-mobile/src/screens/ProfileInterestsScreen.tsx` | **Trash icon removed** from each interest row. **Three‑dots menu** (top right) with “Delete an interest” → **delete mode**: selection circles on rows, violet border when selected, bottom bar “Cancel” / “Delete (N)” with confirm Alert before remove. Milestones hidden in delete mode. |
| **Settings – Profile row & nav** | `alter-ego-mobile/src/screens/SettingsScreen.tsx` | Profile row sub-label set to **“Edit your information”**. Navigate to `SettingsProfile` via `navigation.navigate("SettingsProfile")` with fallback to `getParent()?.navigate("SettingsProfile")`. |
| **SettingsProfile screen** | `alter-ego-mobile/src/screens/SettingsProfileScreen.tsx` | Simplified to header + single line **“Edit your information”** (no avatar/username/email/delete form). |
| **Settings – Logout button** | `alter-ego-mobile/src/screens/SettingsScreen.tsx` | **Log out** is a full‑width **gradient primary button** (52px, `GRADIENTS.button`), same style as app CTAs; previously undefined styles made it small/black. |
| **MainStack – SettingsProfile** | `alter-ego-mobile/src/navigation/MainStack.tsx` | Already had `SettingsProfile` screen; doc and Settings nav updated so Profile row opens it correctly. |
| **Paywall – premium redesign** | `alter-ego-mobile/src/screens/PaywallScreen.tsx` | **Redesigned**: premium dark gradient; Restore (top left), logo icon (centre); headline; **timeline** (3 steps with violet circles + connector); **two plan cards** (MONTHLY / YEARLY, YEARLY with “7 DAYS FREE” badge and strikethrough + $4.16/mo, radio selection); “No Payment Due Now”; CTA “Start My 7-Day Free Trial”; footer disclaimer and Terms \| Privacy links. |

