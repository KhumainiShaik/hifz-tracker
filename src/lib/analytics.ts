import { sessionKey } from "./models";
import type { Memory, Revision } from "./models";
import { uniqueAyahs, TOTAL_AYAHS, juzProgress, SURAHS } from "./quran";
import { addDays, dateInZone, dayDistance } from "./dates";
export function streaks(dates: string[], today: string) {
  const days = [...new Set(dates)].filter((d) => d <= today).sort();
  const set = new Set(days);
  let longest = 0,
    run = 0,
    previous = "";
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  let current = 0,
    cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}
export function goalProgress(actual: number, goal: number) {
  return goal > 0 ? Math.min(100, Math.max(0, (actual / goal) * 100)) : 0;
}
export function newlyMemorized(records: Memory[], from: string, to: string) {
  const before = uniqueAyahs(records.filter((r) => r.date < from));
  return uniqueAyahs(records.filter((r) => r.date <= to)) - before;
}
export function analytics(
  memories: Memory[],
  revisions: Revision[],
  today = dateInZone(),
) {
  memories = [
    ...new Map(memories.map((m) => [sessionKey("m", m), m])).values(),
  ];
  revisions = [
    ...new Map(revisions.map((r) => [sessionKey("r", r), r])).values(),
  ];
  const all = [...memories, ...revisions];
  const unique = uniqueAyahs(memories);
  const juz = juzProgress(memories);
  const month = today.slice(0, 7) + "-01";
  const previousEnd = addDays(month, -1);
  const previousStart = previousEnd.slice(0, 7) + "-01";
  const monthNew = newlyMemorized(memories, month, today),
    previousNew = newlyMemorized(memories, previousStart, previousEnd);
  return {
    unique,
    percent: (unique / TOTAL_AYAHS) * 100,
    juz,
    completeJuz: juz.filter((j) => j.memorized === j.total).length,
    completeSurahs: SURAHS.filter(
      (s) =>
        uniqueAyahs(memories.filter((m) => m.surah === s.number)) === s.ayahs,
    ).length,
    streak: streaks(
      all.map((a) => a.date),
      today,
    ),
    todaySessions: all.filter((s) => s.date === today).length,
    todayAyahs: newlyMemorized(memories, today, today),
    todayRevisions: revisions.filter((s) => s.date === today).length,
    weekNew: newlyMemorized(memories, addDays(today, -6), today),
    monthNew,
    previousNew,
    monthChange: monthNew - previousNew,
    revisionConsistency: new Set(
      revisions
        .filter((r) => r.date >= addDays(today, -27) && r.date <= today)
        .map((r) => r.date),
    ).size,
    calendar: Array.from({ length: 84 }, (_, i) => {
      const date = addDays(today, i - 83);
      return { date, count: all.filter((s) => s.date === date).length };
    }),
    weekly: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - 6);
      return {
        date,
        newAyahs: newlyMemorized(memories, date, date),
        revisions: revisions.filter((r) => r.date === date).length,
      };
    }),
    activeDays: new Set(all.map((s) => s.date)).size,
  };
}
export const categoryForAge = (date: string, today: string) =>
  dayDistance(date, today) <= 1
    ? "sabaq"
    : dayDistance(date, today) <= 30
      ? "sabqi"
      : "manzil";
