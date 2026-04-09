"""
Simple in-process TTL cache for read-heavy data.
Per-worker cache (not shared across workers) — acceptable for read-only data
where slight staleness is fine (leaderboard, settings, stats).
"""

from cachetools import TTLCache

# Leaderboard: expensive query, changes nightly — cache 5 minutes
leaderboard_cache: TTLCache = TTLCache(maxsize=2, ttl=300)

# FAQ: static content — cache 10 minutes
faq_cache: TTLCache = TTLCache(maxsize=1, ttl=600)

# User profile: changes on mission complete — cache 30 seconds
# Key: user_id -> profile dict
profile_cache: TTLCache = TTLCache(maxsize=2000, ttl=30)

# Character stats: changes on mission complete — cache 30 seconds
stats_cache: TTLCache = TTLCache(maxsize=2000, ttl=30)


def invalidate_user_caches(user_id: str) -> None:
    """Call this after any write that changes user state."""
    profile_cache.pop(user_id, None)
    stats_cache.pop(user_id, None)
