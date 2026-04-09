"""
Rate limiting for expensive endpoints.
Uses in-memory storage per worker — sufficient for abuse prevention.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter keyed by IP (good enough for mobile API)
limiter = Limiter(key_func=get_remote_address)
