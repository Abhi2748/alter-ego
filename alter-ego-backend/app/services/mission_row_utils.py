"""Shared helpers for mission rows from PostgREST (boolean coercion)."""


def mission_row_completed(m: dict) -> bool:
    """True only when the mission row is actually completed (handles odd DB/json types)."""
    v = m.get("completed")
    if v is True:
        return True
    if v is False or v is None:
        return False
    if isinstance(v, str):
        return v.strip().lower() in ("true", "t", "1", "yes")
    if isinstance(v, (int, float)):
        return v != 0
    return bool(v)
