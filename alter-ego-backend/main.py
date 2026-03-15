from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, onboarding, missions, home, twin, leaderboard, agents, user, analytics, journal, interests, quit_targets

app = FastAPI(title="ALTER EGO API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes under /api/v1 — schema, auth, onboarding, home, missions (completion + add mission)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(missions.router, prefix="/api/v1")
app.include_router(home.router, prefix="/api/v1")
app.include_router(twin.router, prefix="/api/v1")
app.include_router(leaderboard.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(user.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(journal.router, prefix="/api/v1")
app.include_router(interests.router, prefix="/api/v1")
app.include_router(quit_targets.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ALTER EGO backend is alive"}
