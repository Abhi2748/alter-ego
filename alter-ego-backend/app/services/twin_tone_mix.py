"""
Per-message Twin voice mix — not 100% DNA default, so tone history reflects variety.
"""

from __future__ import annotations

import hashlib

_VALID = ("rival", "philosopher", "silent_force")


def normalize_twin_tone(raw: str | None) -> str:
    t = str(raw or "rival").lower().replace(" ", "_").replace("-", "_")
    if t == "silentforce":
        t = "silent_force"
    return t if t in _VALID else "rival"


def pick_mixed_tone_for_message(dna_tone: str, seed: str) -> str:
    """
    Deterministic mix per (DNA, seed). ~34% DNA baseline, else alternates between
    the other two tones so ratings aggregate across rival / philosopher / silent_force.
    """
    dna = normalize_twin_tone(dna_tone)
    h = int(hashlib.sha256(f"{seed}|{dna}".encode()).hexdigest()[:12], 16)
    r = h % 100
    if r < 34:
        return dna
    others = [t for t in _VALID if t != dna]
    return others[(h >> 8) % 2]
