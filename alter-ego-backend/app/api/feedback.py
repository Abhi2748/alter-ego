"""
Community Board — feedback posts and upvotes.
All posts are anonymous (user_id stored but never returned to clients).
Posts start as 'pending' and are approved via Supabase dashboard.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.api.auth import get_user_id_from_token
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])


def require_user_id(authorization: str = Header(None)) -> str:
    """Bearer token → user id (FastAPI Depends wrapper)."""
    return get_user_id_from_token(authorization)


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


class UpvoteResponse(BaseModel):
    post_id: str
    upvote_count: int
    user_has_voted: bool


class BoardStatsResponse(BaseModel):
    total_posts: int
    total_upvotes: int
    resolved_count: int


@router.get("/posts", response_model=list[PostResponse])
async def list_posts(
    tag: Optional[str] = Query(default=None, description="Filter by tag: bug|suggestion|question|praise"),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(require_user_id),
):
    """
    Returns approved posts sorted by upvote_count DESC.
    Attaches user_has_voted flag for each post.
    """
    try:
        query = (
            supabase_admin.table("feedback_posts")
            .select("id, tag, content, upvote_count, status, created_at")
            .neq("status", "pending")
            .order("upvote_count", desc=True)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if tag and tag in ("bug", "suggestion", "question", "praise"):
            query = query.eq("tag", tag)

        result = query.execute()
        posts = result.data or []

        if not posts:
            return []

        post_ids = [p["id"] for p in posts]
        votes_result = (
            supabase_admin.table("feedback_upvotes")
            .select("post_id")
            .eq("user_id", user_id)
            .in_("post_id", post_ids)
            .execute()
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
        result = (
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
            .execute()
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
        post_result = (
            supabase_admin.table("feedback_posts")
            .select("id, upvote_count, status")
            .eq("id", post_id)
            .neq("status", "pending")
            .limit(1)
            .execute()
        )
        rows = post_result.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Post not found or not yet approved")

        post = rows[0]
        current_count = int(post["upvote_count"])

        existing_vote = (
            supabase_admin.table("feedback_upvotes")
            .select("id")
            .eq("user_id", user_id)
            .eq("post_id", post_id)
            .limit(1)
            .execute()
        )
        has_voted = bool(existing_vote.data)

        if has_voted:
            supabase_admin.table("feedback_upvotes").delete().eq("user_id", user_id).eq("post_id", post_id).execute()
            new_count = max(0, current_count - 1)
            supabase_admin.table("feedback_posts").update({"upvote_count": new_count}).eq("id", post_id).execute()
            return UpvoteResponse(post_id=post_id, upvote_count=new_count, user_has_voted=False)

        supabase_admin.table("feedback_upvotes").insert({"user_id": user_id, "post_id": post_id}).execute()
        new_count = current_count + 1
        supabase_admin.table("feedback_posts").update({"upvote_count": new_count}).eq("id", post_id).execute()
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
        posts_result = (
            supabase_admin.table("feedback_posts")
            .select("upvote_count, status")
            .neq("status", "pending")
            .execute()
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
