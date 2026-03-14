/**
 * In-memory journal entries for List/Editor/Calendar. Replace with API later.
 */

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: string;
  bookmarked: boolean;
  word_count: number;
  created_at: string;
  updated_at: string;
}

let entries: JournalEntry[] = [
  {
    id: "j1",
    title: "Today I showed up",
    content:
      "Today I showed up. Small win. The kind that doesn't feel like much in the moment but adds up over time.",
    date: "2026-03-14",
    bookmarked: true,
    word_count: 47,
    created_at: "2026-03-14T08:30:00Z",
    updated_at: "2026-03-14T08:35:00Z",
  },
  {
    id: "j2",
    title: "Resistance was strong today",
    content: "Didn't want to do any of it. Started anyway.",
    date: "2026-03-13",
    bookmarked: false,
    word_count: 82,
    created_at: "2026-03-13T21:00:00Z",
    updated_at: "2026-03-13T21:10:00Z",
  },
  {
    id: "j3",
    title: "Week three check-in",
    content: "Three weeks in. The habit is forming.",
    date: "2026-03-12",
    bookmarked: false,
    word_count: 61,
    created_at: "2026-03-12T20:00:00Z",
    updated_at: "2026-03-12T20:05:00Z",
  },
  {
    id: "j4",
    title: "Why I'm doing this",
    content: "Started writing this because I need to see my own reasoning.",
    date: "2026-03-10",
    bookmarked: false,
    word_count: 93,
    created_at: "2026-03-10T19:00:00Z",
    updated_at: "2026-03-10T19:15:00Z",
  },
];

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getJournalEntries(): JournalEntry[] {
  return [...entries];
}

export function getJournalEntry(id: string): JournalEntry | undefined {
  return entries.find((e) => e.id === id);
}

export function getJournalEntryByDate(date: string): JournalEntry | undefined {
  return entries.find((e) => e.date === date);
}

export function setJournalEntries(next: JournalEntry[]) {
  entries = next;
  emit();
}

export function upsertJournalEntry(entry: JournalEntry) {
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => (b.date > a.date ? 1 : -1));
  emit();
}

export function toggleBookmark(id: string) {
  const e = entries.find((x) => x.id === id);
  if (e) {
    e.bookmarked = !e.bookmarked;
    emit();
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function createOrUpdateEntry(
  id: string | null,
  date: string,
  title: string,
  content: string,
  bookmarked: boolean
): JournalEntry {
  const word_count = countWords(title + " " + content);
  const now = new Date().toISOString();
  if (id) {
    const existing = entries.find((e) => e.id === id);
    const entry: JournalEntry = {
      id,
      title,
      content,
      date: existing?.date ?? date,
      bookmarked,
      word_count,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    upsertJournalEntry(entry);
    return entry;
  }
  const newId = "j" + Date.now();
  const entry: JournalEntry = {
    id: newId,
    title,
    content,
    date,
    bookmarked,
    word_count,
    created_at: now,
    updated_at: now,
  };
  upsertJournalEntry(entry);
  return entry;
}
