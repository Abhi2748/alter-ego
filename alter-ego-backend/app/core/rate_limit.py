"""
Rate limiting for expensive endpoints.
Uses in-memory storage per worker.
Key function handles Render's reverse proxy (X-Forwarded-For header).
"""

from fastapi import Request
from slowapi import Limiter


def _get_real_ip(request: Request) -> str:
    """
    Extract real client IP, handling Render's load balancer.
    Falls back to 'global' so the limiter never crashes on missing IP.
    """
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "global"


limiter = Limiter(key_func=_get_real_ip)
