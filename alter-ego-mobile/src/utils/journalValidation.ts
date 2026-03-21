/**
 * Journal validation — keep in sync with `alter-ego-backend/app/core/journal_rules.py`.
 * Wrapped text counts as multiple lines (no manual newline required).
 */

const VISUAL_CHARS_PER_LINE = 48;
const MIN_WORDS = 5;

export function combinedJournalText(title: string, content: string): string {
  const t = title.trim();
  const c = content.trim();
  if (t && c) return `${t}\n\n${c}`;
  return t || c;
}

function explicitNonEmptyLines(text: string): number {
  const nonEmpty = text.split("\n").filter((l) => l.trim().length > 0);
  return nonEmpty.length;
}

/** Effective lines: max(explicit newlines, approximate visual wrap). */
export function effectiveLineCount(text: string): number {
  const raw = text.trim();
  if (!raw.length) return 0;
  const explicit = explicitNonEmptyLines(raw);
  const base = explicit > 0 ? explicit : 1;
  const visual = Math.max(base, Math.ceil(raw.length / VISUAL_CHARS_PER_LINE));
  return visual;
}

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Same bar as backend `journal_stored_qualifies_for_mission` (title + body). */
export function journalMeetsSaveMinimum(title: string, content: string): boolean {
  const combined = combinedJournalText(title, content);
  if (!combined.trim()) return false;
  if (wordCount(combined) < MIN_WORDS) return false;
  return effectiveLineCount(combined) >= 2;
}
