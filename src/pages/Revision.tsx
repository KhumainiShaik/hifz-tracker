import { qualityLabel } from "../lib/models";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import { useAuth, useData, useMutation, useToday } from "../lib/hooks";
import { revisionQueue, scheduleAnchors } from "../lib/scheduling";
import { rangeLabel } from "../lib/quran";
import { baseRecord } from "../lib/models";
import type {
  Memory,
  Revision as RevisionRecord,
  Schedule,
} from "../lib/models";
import { database, OWNER_UID } from "../lib/firebase";
import { removeRecord, saveSchedule } from "../lib/repository";
import { prettyDate } from "../lib/dates";
import {
  Card,
  PageHeading,
  Empty,
  Confirm,
  Field,
  Modal,
} from "../components/ui";
import { SessionForm } from "../components/SessionForm";
export function Revision() {
  const { role } = useAuth();
  const { data, settings } = useData();
  const today = useToday(settings.timeZone);
  const [tab, setTab] = useState("due"),
    [form, setForm] = useState<{
      record?: RevisionRecord;
      memory?: Memory;
    } | null>(null),
    [remove, setRemove] = useState<RevisionRecord | null>(null),
    [adjust, setAdjust] = useState<Schedule | null>(null);
  const { busy, run } = useMutation();
  const activeIds = new Set(
    scheduleAnchors(data.memorizedRanges).map((m) => m.id),
  );
  const queue = revisionQueue(
    data.memorizedRanges,
    data.revisionSessions,
    data.revisionSchedules,
    settings.intervals,
    today,
  );
  const due = queue.filter((q) => q.due <= today);
  const shown = tab === "due" ? due : queue;
  function scheduleFor(memory: Memory): Schedule {
    return (
      data.revisionSchedules.find((s) => s.memoryId === memory.id) ?? {
        ...baseRecord(memory.id),
        memoryId: memory.id,
        paused: false,
        overrideDate: "",
      }
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="RETURN. REINFORCE. REMEMBER."
        title="Revision"
        description="Make familiar ayahs feel at home. A gentle rhythm for lasting recall."
        action={
          role === "owner" ? (
            <button className="button" onClick={() => setForm({})}>
              <Plus size={18} />
              Log revision
            </button>
          ) : undefined
        }
      />
      <div className="category-grid">
        {[
          { name: "Sabaq", text: "Your new memorization", icon: Plus },
          {
            name: "Sabqi",
            text: "Recent ayahs, strengthened",
            icon: RotateCcw,
          },
          { name: "Manzil", text: "A lifelong connection", icon: CalendarDays },
        ].map((c) => (
          <Card key={c.name}>
            <span className="activity-icon">
              <c.icon size={20} />
            </span>
            <div>
              <h3>{c.name}</h3>
              <p className="muted compact">{c.text}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="section-heading revision-toolbar">
        <div className="segmented" aria-label="Revision view">
          {[
            { id: "due", name: `Due now (${due.length})` },
            { id: "all", name: "All schedules" },
            { id: "history", name: "History" },
          ].map((t) => (
            <button
              key={t.id}
              aria-pressed={tab === t.id}
              className={tab === t.id ? "selected" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <span className="muted text-sm">
          {due.filter((q) => q.overdue).length} overdue
        </span>
      </div>
      <Card>
        {tab === "history" ? (
          data.revisionSessions.length ? (
            <div>
              {[...data.revisionSessions]
                .sort(
                  (a, b) =>
                    b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
                )
                .map((r) => (
                  <div className="record-row" key={r.id}>
                    <span className="activity-icon gold">
                      <RotateCcw size={18} />
                    </span>
                    <div>
                      <strong>{rangeLabel(r)}</strong>
                      <small>
                        {prettyDate(r.date)} · {r.category}
                        {r.nextReview
                          ? ` · Next: ${prettyDate(r.nextReview)}`
                          : ""}
                      </small>
                      {role === "owner" &&
                        data.privateNotes.find((n) => n.id === `r_${r.id}`)
                          ?.text && (
                          <p className="private-note">
                            Private:{" "}
                            {
                              data.privateNotes.find(
                                (n) => n.id === `r_${r.id}`,
                              )?.text
                            }
                          </p>
                        )}
                    </div>
                    <span
                      className={`pill ${r.quality === "needs-practice" ? "warning" : ""}`}
                    >
                      {qualityLabel(r.quality)}
                    </span>
                    {role === "owner" && (
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit revision ${rangeLabel(r)}`}
                          onClick={() => setForm({ record: r })}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete revision ${rangeLabel(r)}`}
                          onClick={() => setRemove(r)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <Empty title="Make room for revision">
              Your completed revision sessions will appear here.
            </Empty>
          )
        ) : (
          <>
            <div className="section-heading">
              <h2>
                {tab === "due" ? "Your revision queue" : "Your revision rhythm"}
              </h2>
              <span className="pill">{shown.length} ranges</span>
            </div>
            {shown.length ? (
              shown.map((q) => (
                <div className="record-row revision-row" key={q.memory.id}>
                  <span className="surah-number">{q.memory.surah}</span>
                  <div>
                    <strong>{rangeLabel(q.memory)}</strong>
                    <small>
                      {q.category} · {q.memory.end - q.memory.start + 1} ayahs ·{" "}
                      {prettyDate(q.due)}
                    </small>
                  </div>
                  <span className={`pill ${q.overdue ? "warning" : ""}`}>
                    {q.overdue
                      ? "Overdue"
                      : q.due === today
                        ? "Today"
                        : "Upcoming"}
                  </span>
                  {role === "owner" && (
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Adjust schedule for ${rangeLabel(q.memory)}`}
                        onClick={() => setAdjust(scheduleFor(q.memory))}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="button small"
                        onClick={() => setForm({ memory: q.memory })}
                      >
                        Revise
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <Empty
                title={
                  data.memorizedRanges.length
                    ? "You’re all caught up"
                    : "Start with a memorized range"
                }
              >
                {data.memorizedRanges.length
                  ? "Return when your next revision is due, or log a revision at any time."
                  : "A revision schedule is created when you save memorization. You can also log a custom revision now."}
              </Empty>
            )}
            {tab === "all" &&
              data.revisionSchedules
                .filter((s) => s.paused && activeIds.has(s.memoryId))
                .map((s) => {
                  const m = data.memorizedRanges.find(
                    (m) => m.id === s.memoryId,
                  );
                  return m ? (
                    <div className="record-row" key={s.id}>
                      <Pause size={18} />
                      <div>
                        <strong>{rangeLabel(m)}</strong>
                        <small>Schedule paused</small>
                      </div>
                      {role === "owner" && (
                        <button
                          className="button secondary small"
                          onClick={() =>
                            void run(
                              () =>
                                saveSchedule(database(true), OWNER_UID, {
                                  ...s,
                                  paused: false,
                                }),
                              "Schedule resumed.",
                            )
                          }
                        >
                          <Play size={14} />
                          Resume
                        </button>
                      )}
                    </div>
                  ) : null;
                })}
          </>
        )}
      </Card>
      <div className="schedule-explainer">
        <h3>A rhythm you can make your own</h3>
        <p>
          Default gaps: {settings.intervals.map((d) => `${d}d`).join(" → ")}.
          Strong recall advances one step; Okay repeats the step; Needs practice
          returns to the first interval. These are adjustable study preferences.
        </p>
        <p>
          A manual schedule date takes priority until you clear it. Partial and
          custom revisions count as activity without advancing a linked range.
        </p>
      </div>
      {form && (
        <SessionForm
          kind="revision"
          record={form.record}
          memory={form.memory}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {remove && (
        <Confirm
          title="Delete revision session?"
          busy={busy}
          onClose={() => setRemove(null)}
          onConfirm={() =>
            void run(
              () =>
                removeRecord(database(true), OWNER_UID, "revision", remove.id),
              "Revision deleted.",
              () => setRemove(null),
            )
          }
        >
          This removes the session and its private note. The linked revision
          schedule will be recalculated from the remaining history.
        </Confirm>
      )}
      {adjust && (
        <Modal title="Adjust revision schedule" onClose={() => setAdjust(null)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  saveSchedule(
                    database(true),
                    OWNER_UID,
                    adjust,
                    !data.revisionSchedules.some((s) => s.id === adjust.id),
                  ),
                "Schedule synchronized.",
                () => setAdjust(null),
              );
            }}
          >
            <Field
              label="Manual review date"
              hint="Leave empty to use the automatic schedule. A manual date remains in force until cleared."
            >
              <input
                type="date"
                value={adjust.overrideDate}
                onChange={(e) =>
                  setAdjust({ ...adjust, overrideDate: e.target.value })
                }
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={adjust.paused}
                onChange={(e) =>
                  setAdjust({ ...adjust, paused: e.target.checked })
                }
              />
              Pause this schedule
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setAdjust(null)}
              >
                Cancel
              </button>
              <button className="button" disabled={busy}>
                Save schedule
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
