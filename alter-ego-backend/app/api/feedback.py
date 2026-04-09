"""
Community Board — feedback posts and upvotes.
All posts are anonymous (user_id stored but never returned to clients).
Posts start as 'pending' and are approved via Supabase dashboard.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import run_query, supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])


def require_user_id(authorization: str = Header(None)) -> str:
    """Bearer token → user id (FastAPI Depends wrapper)."""
    return get_user_id_from_token(authorization)


def require_admin(x_admin_secret: str = Header(None)) -> None:
    """
    Validates the X-Admin-Secret header against the ADMIN_SECRET env var.
    Raises 403 if missing or incorrect.
    Set ADMIN_SECRET in your environment variables (Render/Railway dashboard).
    """
    secret = os.environ.get("ADMIN_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="ADMIN_SECRET environment variable is not configured on the server.",
        )
    if x_admin_secret != secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret.")


class CreatePostRequest(BaseModel):
    tag: str = Field(..., description="One of: bug, suggestion, question, praise")
    content: str = Field(..., min_length=1, max_length=500)

    @field_validator("tag")
    @classmethod
    def validate_tag(cls, v: str) -> str:
        allowed = {"bug", "suggestion", "question", "praise"}
        if v not in allowed:
            raise ValueError(f"tag must be one of {allowed}")
        return v

    @field_validator("content")
    @classmethod
    def strip_and_length_content(cls, v: str) -> str:
        t = v.strip()
        if len(t) < 10 or len(t) > 280:
            raise ValueError("content must be between 10 and 280 characters (after trimming)")
        return t


class PostResponse(BaseModel):
    id: str
    tag: str
    content: str
    upvote_count: int
    status: str
    created_at: str
    user_has_voted: bool  # True if the requesting user has upvoted this post
    admin_answer: Optional[str] = None


class UpvoteResponse(BaseModel):
    post_id: str
    upvote_count: int
    user_has_voted: bool


class BoardStatsResponse(BaseModel):
    total_posts: int
    total_upvotes: int
    resolved_count: int


class AdminUpdatePostRequest(BaseModel):
    status: str = Field(..., description="New status: approved | rejected | acknowledged | answered | resolved")
    admin_answer: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Required when status is 'answered'. Ignored for other statuses.",
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"approved", "rejected", "acknowledged", "answered", "resolved"}
        if v not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v


@router.get("/posts", response_model=list[PostResponse])
async def list_posts(
    tag: Optional[str] = Query(default=None, description="Filter by tag: bug|suggestion|question|praise"),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(require_user_id),
):
    """
    Returns posts visible to this user: all non-pending (public), plus this user's
    own pending posts (so authors see submissions before moderation).
    Sorted by upvote_count DESC, then created_at DESC.
    """
    try:
        # (status != pending) OR (user_id = me) — others' pending posts stay hidden
        query = (
            supabase_admin.table("feedback_posts")
            .select("id, tag, content, upvote_count, status, created_at")
            .or_(f'user_id.eq."{user_id}",status.neq."pending"')
            .order("upvote_count", desc=True)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if tag and tag in ("bug", "suggestion", "question", "praise"):
            query = query.eq("tag", tag)

        result = await run_query(query)
        posts = result.data or []

        if not posts:
            return []

        post_ids = [p["id"] for p in posts]
        votes_result = await run_query(
            supabase_admin.table("feedback_upvotes")
            .select("post_id")
            .eq("user_id", user_id)
            .in_("post_id", post_ids)
        )
        voted_ids = {str(v["post_id"]) for v in (votes_result.data or [])}

        return [
            PostResponse(
                id=str(p["id"]),
                tag=p["tag"],
                content=p["content"],
                upvote_count=int(p["upvote_count"]),
                status=p["status"],
                created_at=str(p["created_at"]),
                user_has_voted=str(p["id"]) in voted_ids,
                admin_answer=p.get("admin_answer"),
            )
            for p in posts
        ]

    except Exception as e:
        logger.error("list_posts error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to load posts")


@router.post("/posts", response_model=PostResponse, status_code=201)
async def create_post(
    body: CreatePostRequest,
    user_id: str = Depends(require_user_id),
):
    """
    Creates a new feedback post. Status is 'pending' until approved.
    User is not rate-limited here; abuse prevention is handled via moderation.
    """
    try:
        result = await run_query(
            supabase_admin.table("feedback_posts")
            .insert(
                {
                    "user_id": user_id,
                    "tag": body.tag,
                    "content": body.content,
                    "status": "pending",
                    "upvote_count": 0,
                }
            )
        )
        row = (result.data or [None])[0]
        if not row:
            raise HTTPException(status_code=500, detail="Insert failed")

        logger.info("feedback_post_created user=%s tag=%s", user_id, body.tag)

        return PostResponse(
            id=str(row["id"]),
            tag=row["tag"],
            content=row["content"],
            upvote_count=0,
            status=row["status"],
            created_at=str(row["created_at"]),
            user_has_voted=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_post error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to create post")


@router.post("/posts/{post_id}/upvote", response_model=UpvoteResponse)
async def toggle_upvote(
    post_id: str,
    user_id: str = Depends(require_user_id),
):
    """
    Toggles the requesting user's upvote on a post.
    Only approved posts can be upvoted.
    """
    try:
        post_result = await run_query(
            supabase_admin.table("feedback_posts")
            .select("id, upvote_count, status")
            .eq("id", post_id)
            .neq("status", "pending")
            .limit(1)
        )
        rows = post_result.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Post not found or not yet approved")

        post = rows[0]
        current_count = int(post["upvote_count"])

        existing_vote = await run_query(
            supabase_admin.table("feedback_upvotes")
            .select("id")
            .eq("user_id", user_id)
            .eq("post_id", post_id)
            .limit(1)
        )
        has_voted = bool(existing_vote.data)

        if has_voted:
            await run_query(
                supabase_admin.table("feedback_upvotes")
                .delete()
                .eq("user_id", user_id)
                .eq("post_id", post_id)
            )
            new_count = max(0, current_count - 1)
            await run_query(
                supabase_admin.table("feedback_posts")
                .update({"upvote_count": new_count})
                .eq("id", post_id)
            )
            return UpvoteResponse(post_id=post_id, upvote_count=new_count, user_has_voted=False)

        await run_query(
            supabase_admin.table("feedback_upvotes").insert({"user_id": user_id, "post_id": post_id})
        )
        new_count = current_count + 1
        await run_query(
            supabase_admin.table("feedback_posts")
            .update({"upvote_count": new_count})
            .eq("id", post_id)
        )
        return UpvoteResponse(post_id=post_id, upvote_count=new_count, user_has_voted=True)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("toggle_upvote error user=%s post=%s: %s", user_id, post_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to toggle upvote")


@router.get("/stats", response_model=BoardStatsResponse)
async def get_board_stats(user_id: str = Depends(require_user_id)):
    """
    Returns aggregate stats shown in the board header strip.
    Counts only non-pending posts.
    """
    try:
        posts_result = await run_query(
            supabase_admin.table("feedback_posts")
            .select("upvote_count, status")
            .neq("status", "pending")
        )
        rows = posts_result.data or []

        total_posts = len(rows)
        total_upvotes = sum(int(r.get("upvote_count") or 0) for r in rows)
        resolved_count = sum(1 for r in rows if r.get("status") == "resolved")

        return BoardStatsResponse(
            total_posts=total_posts,
            total_upvotes=total_upvotes,
            resolved_count=resolved_count,
        )
    except Exception as e:
        logger.error("get_board_stats error user=%s: %s", user_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to load stats")


@router.get("/admin/posts", response_model=list[dict])
async def admin_list_posts(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    tag: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=200),
    offset: int = Query(default=0, ge=0),
    _: None = Depends(require_admin),
):
    """
    Admin: returns ALL posts (including pending and rejected), sorted by created_at DESC.
    Protected by X-Admin-Secret header.
    """
    try:
        query = (
            supabase_admin.table("feedback_posts")
            .select("id, tag, content, upvote_count, status, created_at, user_id, admin_answer")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if status:
            query = query.eq("status", status)
        if tag and tag in ("bug", "suggestion", "question", "praise"):
            query = query.eq("tag", tag)

        result = await run_query(query)
        posts = result.data or []

        # Never expose user_id to the admin panel — replace with a short ID for display only
        return [
            {
                "id": str(p["id"]),
                "tag": p["tag"],
                "content": p["content"],
                "upvote_count": int(p.get("upvote_count") or 0),
                "status": p["status"],
                "created_at": str(p["created_at"]),
                "admin_answer": p.get("admin_answer"),
            }
            for p in posts
        ]
    except Exception as e:
        logger.error("admin_list_posts error: %s", str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to load posts")


@router.patch("/admin/posts/{post_id}", response_model=dict)
async def admin_update_post(
    post_id: str,
    body: AdminUpdatePostRequest,
    _: None = Depends(require_admin),
):
    """
    Admin: update post status and optionally store an answer.

    Status transitions:
      pending    → approved    (post goes live, upvoting enabled)
      pending    → rejected    (post hidden permanently)
      approved   → acknowledged (bug/suggestion seen by team)
      approved   → answered    (question answered — requires admin_answer)
      approved   → resolved    (bug fixed — increments resolved count in stats)
      acknowledged → resolved  (follow-up resolution)

    Protected by X-Admin-Secret header.
    """
    try:
        # Verify post exists
        check = await run_query(
            supabase_admin.table("feedback_posts")
            .select("id, tag, status")
            .eq("id", post_id)
            .limit(1)
        )
        rows = check.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Post not found")

        post = rows[0]

        # Enforce: 'answered' requires admin_answer text
        if body.status == "answered":
            if not body.admin_answer or not body.admin_answer.strip():
                raise HTTPException(
                    status_code=400,
                    detail="admin_answer is required when setting status to 'answered'.",
                )

        # Build update payload
        update: dict = {"status": body.status}
        if body.status == "answered" and body.admin_answer:
            update["admin_answer"] = body.admin_answer.strip()
        elif body.status != "answered":
            # Clear any previous answer if status is no longer 'answered'
            update["admin_answer"] = None

        await run_query(supabase_admin.table("feedback_posts").update(update).eq("id", post_id))

        logger.info(
            "admin_update_post post=%s old_status=%s new_status=%s",
            post_id,
            post.get("status"),
            body.status,
        )

        return {
            "success": True,
            "post_id": post_id,
            "new_status": body.status,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("admin_update_post error post=%s: %s", post_id, str(e)[:200])
        raise HTTPException(status_code=500, detail="Failed to update post")
