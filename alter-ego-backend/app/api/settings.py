"""
Settings — FAQ, username, notifications, feedback, delete account.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])
logger = logging.getLogger(__name__)

# ── FAQ ────────────────────────────────────────────────────────────────────

FAQ_ITEMS = [
    {
        "q": "What is ALTER EGO?",
        "a": "ALTER EGO is a discipline operating system — not a habit tracker, not a wellness app. Every day you complete missions, build abilities, and evolve your character alongside a Shadow Twin who started in the exact same position as you. The difference between you and your Twin is built entirely by daily choices.",
    },
    {
        "q": "What are the 6 core missions?",
        "a": "Sleep (7+ hours), Movement (30 minutes of activity), Hydration (2 litres of water), Mindfulness (10 minutes of stillness or meditation), No-Phone (a screen-free window — length increases with your level), and Journal (write anything — reflection, observation, plan). These are non-negotiable daily requirements.",
    },
    {
        "q": "How is my streak calculated?",
        "a": "A streak day is earned when you meet your minimum mission requirement. Early on that's 2 core missions or 1 interest mission. The requirement grows as your character advances — you can see your current threshold in your streak detail screen. If you miss a day, your streak resets to zero unless a Streak Freeze activates.",
    },
    {
        "q": "What happens if I miss a day?",
        "a": "Your streak resets to zero. Your XP, abilities, character stage, and all other progress are not lost — only the streak counter. If you had a Streak Freeze in your inventory, it activates automatically (or manually, depending on your freeze settings) and protects the streak for that miss.",
    },
    {
        "q": "What is my Shadow Twin?",
        "a": "Your Twin is an AI version of you that started at the same position on Day 1 — same XP, same level, no pet, zero streak. From that point it evolved based on your onboarding archetype and is recalibrated every 7 days using your real completion data. The gap between you and your Twin is built by your daily choices. The Twin does not coach — it simply exists as a mirror.",
    },
    {
        "q": "How does the Twin chat work?",
        "a": "Tap the Twin tab, then tap the message icon. Your Twin speaks in one of three voices — Rival (competitive, direct), Philosopher (reflective, principled), or Silent Force (minimal, deliberate) — based on your archetype. It responds as the version of you that showed up every day. It does not give advice.",
    },
    {
        "q": "How often does my Twin recalibrate?",
        "a": "The first recalibration happens at Day 7. After that, every 7 days. Each recalibration updates the Twin's intensity and approach based on your completion rate and how you engage. You receive a mail notification each time it recalibrates.",
    },
    {
        "q": "What are the 5 Abilities?",
        "a": "Vitality (built by sleep, movement, and hydration), Focus (built by mindfulness, no-phone, and journal missions), Craft (built by completing interest missions), Discipline (built by core missions, resistance, and recovery), and Willpower (built by personal missions and daily completion bonuses). Each has 10 levels from Dormant to Eternal. Tap any ability in your Profile to see its full progression.",
    },
    {
        "q": "What is XP and how do I earn it?",
        "a": "XP is earned by completing missions. Harder missions give more XP. Your daily XP cap starts at 200 and increases at each character stage — Stage 2 gives 300/day, Stage 3 gives 450/day, up to 1,000/day at Stage 6. Completing missions beyond the cap still counts toward your streak and abilities; only the XP accumulation stops.",
    },
    {
        "q": "What is the Power Score?",
        "a": "Power Score is your composite ranking metric. It combines how far you are through your current character stage (35%), your pet companion's stage (20%), your current streak (25%), and your 30-day completion rate (20%). It updates every night. Consistent daily effort outranks occasional intensity.",
    },
    {
        "q": "When does my companion unlock?",
        "a": "Your companion unlocks on Day 6. Until then, any Pet Food you earn is accumulating. It starts as a Cat and grows through 8 stages — Cat, Fox, Wolf, Panther, Snow Leopard, Tiger, Phoenix, Dragon. At a consistent pace, reaching Dragon takes roughly a year.",
    },
    {
        "q": "How do interest missions get assigned?",
        "a": "Interest missions are generated daily by the Planner — an AI system calibrated to your goal, current level, available time, and recent performance. As your completion rate improves, the Planner upgrades your difficulty. You can rate any mission from its detail view and the Planner reads your feedback.",
    },
    {
        "q": "What is a quit path?",
        "a": "A quit path is a structured program for stopping a habit. It runs in phases, each with resistance missions calibrated to where you are. Completing a full phase without a slip earns the Conquer milestone. Completing missions on a quit path builds Discipline SP. Log slips honestly — the system is built for honesty, not perfection.",
    },
    {
        "q": "How does the Focus timer work?",
        "a": "The Focus tab has three modes — Pomodoro (25/5/15 minute cycles, configurable rounds), Deep Work (30–120 minute single countdown), and Stopwatch (count-up, no target). Sessions are optionally tagged. Every completed session earns Focus SP up to your daily cap. Your stats, weekly chart, and session history are in the Stats sub-tab.",
    },
    {
        "q": "How is my weekly report generated?",
        "a": "Your weekly report is generated every Sunday evening by an AI agent that reviews your full week — completion rates, mission patterns, Twin gap, and what you skipped most. It appears in the Report section of your Profile. Your first report arrives after your first full week.",
    },
]


@router.get("/faq", response_model=dict)
async def get_faq():
    """Returns all FAQ items. No auth required."""
    return {"faq": FAQ_ITEMS}


# ── UPDATE USERNAME ────────────────────────────────────────────────────────


class UpdateUsernameRequest(BaseModel):
    username: str


@router.post("/username", response_model=dict)
async def update_username(
    body: UpdateUsernameRequest,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)

    current = (
        supabase_admin.table("users")
        .select("username")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )
    new_username = (body.username or "").strip().lower()
    if new_username == (current or {}).get("username"):
        return {"success": True, "username": new_username}

    from app.services.onboarding_service import (
        check_username_availability,
        validate_username,
    )

    is_valid, reason = validate_username(body.username)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid username: {reason}")

    availability = await check_username_availability(body.username)
    if not availability.get("available"):
        raise HTTPException(status_code=409, detail="Username already taken")

    supabase_admin.table("users").update({"username": new_username}).eq(
        "id", user_id
    ).execute()

    return {"success": True, "username": new_username}


# ── UPDATE NOTIFICATION SETTINGS ──────────────────────────────────────────


class UpdateNotificationsRequest(BaseModel):
    push_token: str | None = None
    notifications_enabled: bool | None = None
    timezone: str | None = None


@router.post("/notifications", response_model=dict)
async def update_notifications(
    body: UpdateNotificationsRequest,
    authorization: str = Header(None),
):
    user_id = get_user_id_from_token(authorization)
    update_data = {}
    if body.push_token is not None:
        update_data["push_token"] = body.push_token
    if body.notifications_enabled is not None:
        update_data["notifications_enabled"] = body.notifications_enabled
    if body.timezone is not None and str(body.timezone).strip():
        update_data["timezone"] = str(body.timezone).strip()

    if update_data:
        supabase_admin.table("users").update(update_data).eq("id", user_id).execute()

    return {"success": True}


# ── CONTACT / FEEDBACK ─────────────────────────────────────────────────────


class FeedbackRequest(BaseModel):
    type: str  # bug | concern | suggestion | other
    content: str
    app_version: str | None = None


@router.post("/feedback", response_model=dict)
async def submit_feedback(
    body: FeedbackRequest,
    authorization: str = Header(None),
):
    """
    Stores feedback in feedback_submissions table.
    Optionally triggers Formspree webhook if FORMSPREE_WEBHOOK_URL is set.
    """
    user_id = get_user_id_from_token(authorization)

    if body.type not in ("bug", "concern", "suggestion", "other"):
        raise HTTPException(
            status_code=400,
            detail="type must be one of: bug, concern, suggestion, other",
        )

    supabase_admin.table("feedback_submissions").insert(
        {
            "user_id": user_id,
            "type": body.type,
            "content": (body.content or "").strip(),
            "app_version": body.app_version,
        }
    ).execute()

    payload = {
        "user_id": user_id,
        "type": body.type,
        "content": (body.content or "").strip(),
        "app_version": body.app_version,
        "submitted_at": datetime.utcnow().isoformat() + "Z",
    }

    await _notify_feedback_outside_db(payload)

    return {"success": True, "message": "Feedback received. Thank you."}


def _normalize_webhook_url(raw: str) -> str:
    u = str(raw).strip()
    if len(u) >= 2 and u[0] == u[-1] and u[0] in "\"'":
        u = u[1:-1].strip()
    return u


def _feedback_webhook_urls() -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for key in (
        "FORMSPREE_WEBHOOK_URL",
        "FEEDBACK_WEBHOOK_URL",
        "FORMSPREE_FEEDBACK_URL",
    ):
        raw = os.environ.get(key)
        if not raw:
            continue
        u = _normalize_webhook_url(raw)
        if u and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def _is_formspree_url(url: str) -> bool:
    lower = url.lower()
    return "formspree.io" in lower or "formspree.com" in lower


async def _post_feedback_webhooks(payload: dict) -> None:
    for url in _feedback_webhook_urls():
        try:
            async with httpx.AsyncClient() as client:
                if _is_formspree_url(url):
                    # Formspree expects form fields (not raw JSON) for email delivery
                    form = {
                        "_subject": f"[ALTER EGO] {payload.get('type', 'feedback')} feedback",
                        "feedback_type": str(payload.get("type") or ""),
                        "user_id": str(payload.get("user_id") or ""),
                        "app_version": str(payload.get("app_version") or ""),
                        "submitted_at": str(payload.get("submitted_at") or ""),
                        "message": str(payload.get("content") or ""),
                    }
                    r = await client.post(
                        url,
                        data=form,
                        headers={"Accept": "application/json"},
                        timeout=12.0,
                    )
                else:
                    r = await client.post(url, json=payload, timeout=12.0)
                if r.status_code >= 400:
                    logger.warning(
                        "Feedback webhook HTTP %s for %s: %s",
                        r.status_code,
                        url[:48],
                        (r.text or "")[:300],
                    )
        except Exception as e:
            logger.warning("Feedback webhook failed for %s: %s", url[:48], e)


async def _send_feedback_via_resend(payload: dict) -> None:
    """Optional: set RESEND_API_KEY + FEEDBACK_NOTIFY_EMAIL (team inbox)."""
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    to_email = (os.environ.get("FEEDBACK_NOTIFY_EMAIL") or "").strip()
    from_email = (os.environ.get("RESEND_FROM_EMAIL") or "onboarding@resend.dev").strip()
    if not api_key or not to_email:
        return
    subject = f"[ALTER EGO] {payload.get('type', 'feedback')} — {payload.get('user_id', '')[:8]}…"
    text_body = (
        f"type: {payload.get('type')}\n"
        f"user_id: {payload.get('user_id')}\n"
        f"app_version: {payload.get('app_version')}\n"
        f"submitted_at: {payload.get('submitted_at')}\n\n"
        f"{payload.get('content', '')}"
    )
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": [to_email],
                    "subject": subject[:998],
                    "text": text_body,
                },
                timeout=15.0,
            )
            if r.status_code >= 400:
                logger.warning(
                    "Resend feedback email failed HTTP %s: %s",
                    r.status_code,
                    (r.text or "")[:400],
                )
    except Exception as e:
        logger.warning("Resend feedback email failed: %s", e)


async def _notify_feedback_outside_db(payload: dict) -> None:
    webhook_urls = _feedback_webhook_urls()
    resend_configured = bool(
        (os.environ.get("RESEND_API_KEY") or "").strip()
        and (os.environ.get("FEEDBACK_NOTIFY_EMAIL") or "").strip()
    )
    await _post_feedback_webhooks(payload)
    await _send_feedback_via_resend(payload)
    if not webhook_urls and not resend_configured:
        logger.info(
            "Feedback stored in DB; no webhook (FORMSPREE_WEBHOOK_URL / FEEDBACK_WEBHOOK_URL / "
            "FORMSPREE_FEEDBACK_URL) or Resend (RESEND_API_KEY + FEEDBACK_NOTIFY_EMAIL) — "
            "configure one to receive email alerts."
        )


# ── DELETE ACCOUNT ─────────────────────────────────────────────────────────


@router.delete("/account", response_model=dict)
async def delete_account(authorization: str = Header(None)):
    """
    Deletes all user data. Irreversible.
    Cascades via FK constraints. Then deletes the auth user.
    """
    user_id = get_user_id_from_token(authorization)

    supabase_admin.table("users").delete().eq("id", user_id).execute()
    try:
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception:
        pass

    return {"success": True, "message": "Account deleted."}
