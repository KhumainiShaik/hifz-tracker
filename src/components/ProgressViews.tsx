import { BookOpen, RotateCcw } from "lucide-react";
import type { Memory, Revision } from "../lib/models";
import { rangeLabel, juzProgress } from "../lib/quran";
import { prettyDate } from "../lib/dates";
import { Empty } from "./ui";
export function JuzGrid({ memories }: { memories: Memory[] }) {
  return (
    <div className="juz-grid">
      {juzProgress(memories).map((j) => (
        <div
          key={j.number}
          className={`juz-cell ${j.percent === 100 ? "complete" : ""}`}
          title={`Juz ${j.number}: ${j.memorized} of ${j.total} ayahs (${j.percent.toFixed(1)}%)`}
        >
          <span>{j.number}</span>
          <div className="juz-fill" style={{ height: `${j.percent}%` }} />
          <span className="sr-only">
            {j.memorized} of {j.total} ayahs
          </span>
        </div>
      ))}
    </div>
  );
}
export function ActivityList({
  memories,
  revisions,
  limit = 6,
}: {
  memories: Memory[];
  revisions: Revision[];
  limit?: number;
}) {
  const activity = [
    ...memories.map((m) => ({ ...m, kind: "memory" as const })),
    ...revisions.map((r) => ({ ...r, kind: "revision" as const })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, limit);
  return activity.length ? (
    <div className="activity-list">
      {activity.map((a) => (
        <div key={`${a.kind}-${a.id}`} className="activity-row">
          <span
            className={`activity-icon ${a.kind === "revision" ? "gold" : ""}`}
          >
            {a.kind === "memory" ? (
              <BookOpen size={18} />
            ) : (
              <RotateCcw size={18} />
            )}
          </span>
          <div>
            <strong>{rangeLabel(a)}</strong>
            <small>
              {a.kind === "memory"
                ? "Memorization"
                : `Revision · ${"category" in a ? a.category : ""}`}{" "}
              · {a.end - a.start + 1} ayahs
            </small>
          </div>
          <time dateTime={a.date}>{prettyDate(a.date)}</time>
        </div>
      ))}
    </div>
  ) : (
    <Empty title="Your story starts here">
      Completed memorization and revision sessions will appear here.
    </Empty>
  );
}
