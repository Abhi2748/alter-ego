# ALTER EGO System Deep Dive

This document explains how your app is built today, how it behaves at scale, how your agent system works, and what to improve next to reach production-grade reliability.

It is written for learning + execution: clear enough for a recent graduate, but structured like a real engineering architecture review.

---

## 1) Executive Snapshot

ALTER EGO is a multi-layer app with clean separation of concerns:

- **Mobile app**: React Native + Expo + TypeScript (`alter-ego-mobile/`)
- **Backend API**: FastAPI + APScheduler (`alter-ego-backend/`)
- **Data/Auth**: Supabase (Postgres + Auth)
- **AI layer**: Specialized agent modules (`alter-ego-backend/app/agents/`)
- **State + fetching**: Zustand + React Query on mobile

This is already a strong architecture for closed beta. The major next step is operational hardening (observability, idempotency, worker queue, and scaling patterns).

---

## 2) Real System Architecture (As Implemented)

## 2.1 Backend composition

The FastAPI app registers domain routers and starts scheduler jobs on boot.

- Entry point: `alter-ego-backend/main.py`
- Key domains: auth, onboarding, missions, twin, reports, leaderboard, profile, quits, sigil, settings, stats, etc.
- Background jobs start at app startup (`setup_scheduler().start()`).

This gives you:
- clear domain boundaries,
- easier debugging by feature,
- safer future refactors (route modules are isolated).

## 2.2 Mobile composition

- Global providers in `alter-ego-mobile/src/providers/AppProviders.tsx`
- Auth/session state in `src/store/authStore.ts`
- Profile/global user state in `src/store/userStore.ts`
- All HTTP calls through `src/services/api.ts`

Your base API client centralizes:
- Bearer token attachment,
- network retries,
- 401 refresh flow + local sign-out if refresh token is stale.

This is exactly how mature apps avoid duplicated networking logic.

## 2.3 Data and auth model

- Client authenticates via Supabase Auth.
- Backend verifies JWT and resolves `user_id`.
- Server-side DB writes use service-role Supabase client.
- Business state is persisted in relational tables (`users`, `missions`, `discipline_dna`, `weekly_reports`, `leaderboard_scores`, etc.).

---

## 3) End-to-End Runtime Flow

## 3.1 App startup

1. App initializes providers.
2. Auth store restores session.
3. If authenticated, profile fetch runs.
4. API calls use centralized client with auth+retry behavior.

## 3.2 Request lifecycle

1. Screen/hook calls service function.
2. `apiClient` sends request with JWT.
3. Backend route validates auth.
4. Service layer computes business logic.
5. DB updates + response payload returned.
6. UI state/query cache updates.

## 3.3 Daily lifecycle via scheduler

Hourly scheduler scans users and runs per-user jobs at local timezone windows:

- daily mission reset,
- pet unlock + streak break checks,
- twin simulation,
- weekly report generation,
- nudge checks,
- recalibration jobs.

This pattern is good because behavior is user-local and predictable.

---

## 4) Product Engine Breakdown

## 4.1 Missions and progression

Core behavior:
- today mission generation,
- completion processing,
- XP/PF updates,
- streak updates,
- stage progression,
- milestone side effects,
- derived metrics (power score/stat gains/sigil updates).

Your architecture puts the heavy business logic in backend services (not frontend), which is correct.

## 4.2 Twin system

Twin is a hybrid system:
- deterministic simulation logic for day-level progression,
- LLM chat for conversational interaction,
- safety classifier and constraints before/around response generation.

This avoids over-reliance on LLM for game-state truth.

## 4.3 Reports and nudges

- Weekly reports use dedicated generation logic and data assembly.
- Nudges are categorized and controlled by explicit rules + constrained text generation.
- Built-in anti-repetition and tone framing are good quality controls.

## 4.4 Sigil/meta-progression

Sigil is layered as secondary progression:
- daily surge state,
- aether accumulation,
- level thresholds/progress.

This is good separation from core rewards (XP + PF).

---

## 5) Agent System Design (Current State)

You already follow an advanced pattern: **multi-agent specialization**.

Examples in `app/agents/`:
- `twin_chat_agent.py`
- `nudge_agent.py`
- `report_agent.py`
- `interest_planner_agent.py`
- quit profile/insight/mission agents
- normalization and guardrail helpers

## 5.1 Shared agent infrastructure

`app/agents/base.py` provides:
- default model config (`gpt-4o-mini` unless overridden),
- structured response generation via Pydantic schema,
- centralized run wrapper.

This is one of the strongest design choices in your stack.

## 5.2 Why this design works

- Better control over outputs (schema validity).
- Easier to test each agent independently.
- Lower blast radius when one agent prompt changes.
- Clear accountability: each module has one job.

## 5.3 Current risks in agent systems

- Prompt drift can degrade quality silently.
- Cost and latency spikes under load.
- Failures can impact UX if no deterministic fallback exists.
- Quality issues can go unnoticed without telemetry/eval loops.

---

## 6) Scale Readiness Review

For closed beta: solid.
For larger scale (10k to 1M users): needs infrastructure evolution.

## 6.1 What is already scalable

- Clear API layering.
- Centralized auth/error handling on client.
- Domain-separated backend routes/services.
- Scheduled processing architecture.
- Agent specialization.

## 6.2 Bottlenecks you will hit first

1. **Scheduler fan-out cost**
- Hourly jobs that loop many users can become expensive.

2. **AI latency/cost**
- Synchronous LLM calls in user flows can slow endpoints.

3. **No dedicated worker queue**
- Heavy background work may compete with API responsiveness.

4. **Observability gap**
- Without robust metrics/traces, diagnosis becomes guesswork.

5. **Retry/idempotency edge cases**
- Duplicate processing can occur in distributed retries unless guarded.

---

## 7) Best-Practice Upgrade Plan (Practical)

## Phase 1: Before broad beta expansion (highest ROI)

1. **Observability baseline**
- Add request IDs, structured logs, endpoint latency histograms, scheduler run metrics.
- Define minimal dashboards: error rate, p95 latency, AI failures, job backlog.

2. **Idempotency guards**
- For mission generation/report/nudge jobs, add dedupe keys per user/day/job.
- Ensure retried job cannot duplicate side effects.

3. **Fallback behavior for every agent**
- If model call fails, return deterministic safe fallback text.
- Never block critical flows on LLM response.

4. **Endpoint protection**
- Tune rate limits by endpoint category (chat > strict, profile > relaxed).

## Phase 2: Post-beta reliability

1. **Introduce async workers**
- Move non-interactive heavy AI jobs to queue workers (Redis-backed worker system).
- API should enqueue + return fast where possible.

2. **DB performance hardening**
- Query profiling and index tuning on hot paths.
- Add periodic top-N slow query review.

3. **Caching strategy**
- Cache high-read computed responses (leaderboard snapshots, some profile aggregates).

## Phase 3: Scale architecture

1. Separate API and worker deployments.
2. Event-driven fanout for post-completion side effects.
3. SLOs + alerts (latency/error budgets).

---

## 8) How Big Companies Think (And How To Apply It Here)

They do not rely on one giant “smart” function.
They build:

- small deterministic services,
- strongly typed contracts,
- strict observability,
- queue-based async workloads,
- continuous testing + canary releases.

How you apply this:
- keep business truth deterministic in services,
- use agents for language/personalization, not core state authority,
- add robust failure handling and measurement.

---

## 9) Testing Strategy You Should Adopt

## 9.1 Backend tests

- API contract tests for critical endpoints:
  - auth, onboarding complete, missions today/complete, twin chat, profile overview.
- Service-level tests for streak/progression/mission generation rules.
- Scheduler job tests with mocked timezone/user sets.

## 9.2 Agent tests

- Schema validation tests for every agent output.
- Regression prompt tests (same input set, compare quality over prompt versions).
- Safety tests for twin chat classifier and blocked categories.

## 9.3 Mobile tests

- Critical UI integration flows:
  - signup/signin,
  - onboarding completion,
  - mission completion updates.
- Networking error behavior tests (offline/expired token).

---

## 10) Security and Production Hygiene

- Keep service keys only on backend.
- Continue never trusting client user IDs.
- Validate authorization on every protected route.
- Add audit logs for sensitive profile/account changes.
- Keep dependency updates regular and pinned where appropriate.
- Ensure secrets are never committed.

---

## 11) Recommended Engineering Standards For This Repo

1. All network calls from screens must go through services/hooks/store abstractions.
2. Any business-rule change must include backend tests.
3. Any agent prompt change must include regression eval checks.
4. Any new background job must be idempotent.
5. Any user-visible generated text path must have fallback copy.
6. Any new metric formula (XP/PF/Power/Sigil) must have single source of truth constants.

---

## 12) Suggested Next 30-Day Learning + Build Plan

Week 1:
- Add observability and request/job IDs.
- Create architecture diagram from this doc.

Week 2:
- Add idempotency keys to mission/report/nudge scheduled workflows.
- Add fallback paths for all agent calls.

Week 3:
- Build first agent regression test suite.
- Add API contract tests for auth + mission core paths.

Week 4:
- Introduce worker queue for one heavy workflow (weekly report or nudges), then expand.

---

## 13) Honest Assessment

You started from non-traditional background and still assembled a real product-grade foundation.

What you have now is not “toy code.” It is a serious beta architecture with correct core instincts:
- separation of concerns,
- deterministic business logic,
- specialized AI modules,
- centralized networking,
- scheduled maintenance lifecycle.

The main leap remaining is **operational excellence**, not re-building everything.

---

## 14) Appendix — Key Files To Study

Backend:
- `alter-ego-backend/main.py`
- `alter-ego-backend/app/core/scheduler.py`
- `alter-ego-backend/app/core/constants.py`
- `alter-ego-backend/app/api/*.py`
- `alter-ego-backend/app/services/*.py`
- `alter-ego-backend/app/agents/base.py`
- `alter-ego-backend/app/agents/twin_chat_agent.py`
- `alter-ego-backend/app/agents/nudge_agent.py`
- `alter-ego-backend/app/agents/report_agent.py`

Mobile:
- `alter-ego-mobile/src/providers/AppProviders.tsx`
- `alter-ego-mobile/src/services/api.ts`
- `alter-ego-mobile/src/store/authStore.ts`
- `alter-ego-mobile/src/store/userStore.ts`
- `alter-ego-mobile/src/hooks/*.ts`
- `alter-ego-mobile/src/navigation/*.tsx`
- `alter-ego-mobile/src/screens/*.tsx`

Reference docs:
- `CLAUDE.md`
- `docs/ALTER_EGO_HANDOFF.md`
- `PROJECT_WORKFLOW.md`

