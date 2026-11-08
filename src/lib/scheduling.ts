import { sessionKey } from "./models";
import type { Memory, Revision, Schedule } from "./models";
import { addDays } from "./dates";
import { categoryForAge } from "./analytics";
/** Intervals are gaps after each review, not offsets from the original memorization.
 * Strong advances one step; Okay repeats the step; Needs Practice resets to step 0.
 * Replaying sorted history makes edits/deletions deterministic, without timer writes.
 */
export function nextReview(
  memory: Memory,
  revisions: Revision[],
  intervals: number[],
  today: string,
  control?: Schedule,
) {
  if (control?.paused) return null;
  let step = 0,
    due = addDays(memory.date, intervals[0]);
  const seen = new Set<string>();
  const related = revisions
    .filter(
      (r) =>
        r.memoryId === memory.id &&
        r.date >= memory.date &&
        r.surah === memory.surah &&
        r.start <= memory.start &&
        r.end >= memory.end,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
  for (const r of related) {
    const key = sessionKey("r", r);
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.quality === "strong") step = Math.min(step + 1, intervals.length - 1);
    if (r.quality === "needs-practice") step = 0;
    due = r.nextReview || addDays(r.date, intervals[step]);
  }
  if (control?.overrideDate) due = control.overrideDate;
  return {
    memory,
    due,
    step,
    category: categoryForAge(memory.date, today),
    overdue: due < today,
    quality: related.at(-1)?.quality ?? memory.confidence,
  };
}
const rangeKey = (m: Memory) => `${m.surah}_${m.start}_${m.end}`;
/** Re-recording an identical range restarts one effective schedule, never a second queue entry. */
export function scheduleAnchors(memories: Memory[]): Memory[] {
  const groups = new Map<string, Memory>();
  const newest = [...memories].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt - a.createdAt ||
      b.id.localeCompare(a.id),
  );
  for (const m of newest)
    if (!groups.has(rangeKey(m))) groups.set(rangeKey(m), m);
  return [...groups.values()];
}
export function revisionQueue(
  memories: Memory[],
  revisions: Revision[],
  schedules: Schedule[],
  intervals: number[],
  today: string,
) {
  return scheduleAnchors(memories)
    .map((m) => {
      const linkedIds = new Set(
        memories
          .filter((other) => rangeKey(other) === rangeKey(m))
          .map((other) => other.id),
      );
      const history = revisions.map((r) =>
        linkedIds.has(r.memoryId) ? { ...r, memoryId: m.id } : r,
      );
      return nextReview(
        m,
        history,
        intervals,
        today,
        schedules.find((s) => s.memoryId === m.id),
      );
    })
    .filter((r) => r !== null)
    .sort(
      (a, b) =>
        a.due.localeCompare(b.due) || a.memory.id.localeCompare(b.memory.id),
    );
}
