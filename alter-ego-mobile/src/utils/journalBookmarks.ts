/**
 * Journal bookmarks — stored locally per user (AsyncStorage).
 * Key: array of date strings (YYYY-MM-DD).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@alter_ego_journal_bookmarks";

export async function getJournalBookmarks(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setJournalBookmarks(dates: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(dates));
}

export async function toggleJournalBookmark(date: string): Promise<boolean> {
  const current = await getJournalBookmarks();
  const set = new Set(current);
  const next = set.has(date) ? false : true;
  if (next) set.add(date);
  else set.delete(date);
  await setJournalBookmarks(Array.from(set));
  return next;
}
