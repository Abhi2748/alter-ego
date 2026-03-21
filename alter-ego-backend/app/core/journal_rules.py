"""
Journal entry rules — shared by save endpoint and mission completion.

Visual "lines" approximate wrapped text in the mobile editor (~48 chars per line
at 16px body width) so one long paragraph counts as multiple lines without
requiring a manual newline from the keyboard.
"""

from __future__ import annotations

# Match mobile `journalValidation.ts`
VISUAL_CHARS_PER_LINE = 48
# Minimum words so a single long "aaaaaaaa" line cannot qualify
MIN_WORDS_FOR_QUALIFIED_ENTRY = 5


def full_journal_text(title: str | None, content: str | None) -> str:
    t = (title or "").strip()
    c = (content or "").strip()
    if t and c:
        return f"{t}\n\n{c}"
    return t or c


def effective_line_count(text: str) -> int:
    raw = (text or "").strip()
    if not raw:
        return 0
    non_empty = [ln for ln in raw.split("\n") if ln.strip()]
    explicit = len(non_empty) if non_empty else 1
    visual = max(explicit, (len(raw) + VISUAL_CHARS_PER_LINE - 1) // VISUAL_CHARS_PER_LINE)
    return int(visual)


def word_count(text: str) -> int:
    return len([w for w in (text or "").strip().split() if w])


def journal_stored_qualifies_for_mission(title: str | None, content: str | None) -> bool:
    """True when today's saved journal meets the same bar as the app editor."""
    combined = full_journal_text(title, content)
    if not combined.strip():
        return False
    if word_count(combined) < MIN_WORDS_FOR_QUALIFIED_ENTRY:
        return False
    return effective_line_count(combined) >= 2
