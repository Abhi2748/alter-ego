/**
 * Calendar dates from the API are YYYY-MM-DD (user's logical day).
 * `new Date("2025-03-20")` parses as UTC midnight and shifts the local calendar day
 * west of UTC — wrong for month grids. Use these helpers instead.
 */

export function parseIsoDateParts(iso: string): { y: number; m: number; d: number } | null {
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [ys, ms, ds] = s.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}

/** Device-local calendar YYYY-MM-DD (not UTC via toISOString). */
export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Compare two YYYY-MM-DD strings (same length, lexicographic works). */
export function isoDateStringGte(a: string, b: string): boolean {
  return String(a).slice(0, 10) >= String(b).slice(0, 10);
}

export function isoDateStringGt(a: string, b: string): boolean {
  return String(a).slice(0, 10) > String(b).slice(0, 10);
}

/** First month shown in streak calendar (0-based month index). */
export function earliestNavigableMonth(joinYmd: string | null | undefined): { year: number; month: number } | null {
  const p = parseIsoDateParts(joinYmd ?? "");
  if (!p) return null;
  return { year: p.y, month: p.m };
}

export function isMonthBeforeView(
  year: number,
  monthIndex: number,
  earliest: { year: number; month: number } | null
): boolean {
  if (!earliest) return false;
  return year < earliest.year || (year === earliest.year && monthIndex < earliest.month);
}

export function clampViewMonthToEarliest(
  vm: { year: number; month: number },
  earliest: { year: number; month: number } | null
): { year: number; month: number } {
  if (!earliest) return vm;
  if (isMonthBeforeView(vm.year, vm.month, earliest)) {
    return { year: earliest.year, month: earliest.month };
  }
  return vm;
}

/** Streak calendar / day detail: only [join, today] inclusive (calendar YYYY-MM-DD). */
export function isCalendarDayTappable(
  dateYmd: string,
  joinYmd: string | null | undefined,
  todayYmd: string
): boolean {
  const d = String(dateYmd).slice(0, 10);
  const j = joinYmd ? String(joinYmd).slice(0, 10) : null;
  const t = String(todayYmd).slice(0, 10);
  if (j && d < j) return false;
  if (d > t) return false;
  return true;
}

/**
 * Days in [year, month] on or after join date (inclusive). Used for streak month progress denominator.
 * If join is after the month, returns 0. If join before this month, returns full month length.
 */
export function countDaysInMonthOnOrAfterJoin(
  year: number,
  monthIndexZeroBased: number,
  joinYmd: string | null | undefined
): number {
  if (!joinYmd) {
    return new Date(year, monthIndexZeroBased + 1, 0).getDate();
  }
  const lastDay = new Date(year, monthIndexZeroBased + 1, 0).getDate();
  const monthPrefix = `${year}-${String(monthIndexZeroBased + 1).padStart(2, "0")}`;
  const joinHead = String(joinYmd).slice(0, 7);
  if (joinHead > monthPrefix) return 0;
  if (joinHead < monthPrefix) {
    return lastDay;
  }
  const parts = parseIsoDateParts(String(joinYmd));
  const joinDay = parts?.d ?? 1;
  return Math.max(0, lastDay - joinDay + 1);
}

/**
 * First local calendar day for the user from registration timestamp.
 * Matches backend logic for streak heatmap eligibility.
 */
export function registrationFirstLocalCalendarDay(registrationIso: string | undefined | null): string | null {
  if (!registrationIso) return null;
  const head = String(registrationIso).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head) && String(registrationIso).length <= 10) {
    return head;
  }
  const t = new Date(registrationIso);
  if (Number.isNaN(t.getTime())) return null;
  return formatLocalYmd(t);
}
