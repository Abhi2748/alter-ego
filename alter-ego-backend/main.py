from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.api.missions import router as missions_router
from app.api.onboarding import router as onboarding_router
from app.core.scheduler import setup_scheduler

app = FastAPI(title="ALTER EGO API", version="1.0.0")

# Only routers built in the current build
app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(missions_router)

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
