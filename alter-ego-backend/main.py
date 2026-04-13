from fastapi import FastAPI
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.auth import router as auth_router
from app.api.achievements import router as achievements_router
from app.api.feedback import router as feedback_router
from app.api.focus import router as focus_router
from app.api.leaderboard import router as leaderboard_router
from app.api.mail import router as mail_router
from app.api.mirror import router as mirror_router
from app.api.missions import router as missions_router
from app.api.onboarding import router as onboarding_router
from app.api.profile import router as profile_router
from app.api.return_reason import router as return_reason_router
from app.api.reports import router as reports_router
from app.api.seasons import router as seasons_router
from app.api.settings import router as settings_router
from app.api.stats import router as stats_router
from app.api.quits import router as quits_router
from app.api.sigil import router as sigil_router
from app.api.twin import router as twin_router
from app.core.rate_limit import limiter
from app.core.scheduler import setup_scheduler

app = FastAPI(title="ALTER EGO API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Only routers built in the current build
app.include_router(auth_router)
app.include_router(achievements_router)
app.include_router(feedback_router)
app.include_router(focus_router)
app.include_router(onboarding_router)
app.include_router(missions_router)
app.include_router(twin_router)
app.include_router(leaderboard_router)
app.include_router(reports_router)
app.include_router(mail_router)
app.include_router(profile_router)
app.include_router(return_reason_router)
app.include_router(mirror_router)
app.include_router(settings_router)
app.include_router(stats_router)
app.include_router(quits_router)
app.include_router(seasons_router)
app.include_router(sigil_router)


@app.on_event("startup")
async def startup_event():
    scheduler = setup_scheduler()
    scheduler.start()
    app.state.scheduler = scheduler


@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/admin", include_in_schema=False)
async def admin_panel():
    return FileResponse("admin.html")
