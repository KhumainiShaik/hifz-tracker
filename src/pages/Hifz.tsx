import { qualityLabel } from "../lib/models";
import { useState } from "react";
import { Plus, Search, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useAuth, useData, useMutation } from "../lib/hooks";
import {
  SURAHS,
  uniqueAyahs,
  rangePages,
  rangeJuz,
  unionRanges,
} from "../lib/quran";
import type { Memory } from "../lib/models";
import { database, OWNER_UID } from "../lib/firebase";
import { removeRecord } from "../lib/repository";
import { prettyDate } from "../lib/dates";
import { Card, PageHeading, Progress, Empty, Confirm } from "../components/ui";
import { SessionForm } from "../components/SessionForm";
import { JuzGrid } from "../components/ProgressViews";
export function Hifz() {
  const { role } = useAuth();
  const { data, settings } = useData();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [open, setOpen] = useState<number | null>(null),
    [form, setForm] = useState<Memory | "new" | null>(null),
    [remove, setRemove] = useState<Memory | null>(null);
  const { busy, run } = useMutation();
  const surahs = SURAHS.map((s) => ({
    ...s,
    records: data.memorizedRanges.filter((m) => m.surah === s.number),
    count: uniqueAyahs(
      data.memorizedRanges.filter((m) => m.surah === s.number),
    ),
  })).filter(
    (s) =>
      `${s.number} ${s.name} ${s.arabic} ${s.english}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "complete" && s.count === s.ayahs) ||
        (filter === "partial" && s.count > 0 && s.count < s.ayahs) ||
        (filter === "new" && s.count === 0)),
  );
  return (
    <>
      <PageHeading
        eyebrow="MEMORIZE WITH INTENTION"
        title="My Hifz"
        description="A living record of every ayah you carry with you."
        action={
          role === "owner" ? (
            <button className="button" onClick={() => setForm("new")}>
              <Plus size={18} />
              Add memorization
            </button>
          ) : undefined
        }
      />
      <Card className="juz-overview">
        <div className="section-heading">
          <div>
            <h2>Across the 30 Juz</h2>
            <p className="muted compact">
              {uniqueAyahs(data.memorizedRanges).toLocaleString()} unique ayahs
              · {((uniqueAyahs(data.memorizedRanges) / 6236) * 100).toFixed(1)}%
              of the Quran
            </p>
          </div>
          <span className="pill">114 Surahs</span>
        </div>
        <JuzGrid memories={data.memorizedRanges} />
        <small className="muted">
          Each Juz is measured against its own ayah boundaries. Unequal lengths
          are accounted for.
        </small>
      </Card>
      <div className="filter-bar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search Surahs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a Surah by name or number…"
          />
        </label>
        <select
          aria-label="Filter by memorization status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Surahs</option>
          <option value="partial">In progress</option>
          <option value="complete">Completed</option>
          <option value="new">Not started</option>
        </select>
      </div>
      <Card className="surah-list">
        <div className="table-caption">
          YOUR MEMORIZATION <span>{surahs.length} Surahs</span>
        </div>
        {surahs.length === 0 ? (
          <Empty title="No matching Surahs">
            Try another name or choose a different filter.
          </Empty>
        ) : (
          surahs.map((s) => (
            <div className="surah-item" key={s.number}>
              <button
                className="surah-summary"
                aria-expanded={open === s.number}
                aria-controls={`surah-${s.number}`}
                onClick={() => setOpen(open === s.number ? null : s.number)}
              >
                <span className="surah-number">{s.number}</span>
                <span className="surah-name">
                  <strong>{s.name}</strong>
                  <small>
                    {s.english} · {s.ayahs} ayahs
                  </small>
                </span>
                <span className="arabic" lang="ar" dir="rtl">
                  {s.arabic}
                </span>
                <span className="surah-progress">
                  <strong>
                    {s.count}
                    <small> / {s.ayahs}</small>
                  </strong>
                  <Progress
                    value={(s.count / s.ayahs) * 100}
                    label={`${s.name} memorization`}
                  />
                </span>
                <ChevronDown
                  size={16}
                  className={open === s.number ? "rotate" : ""}
                />
              </button>
              {open === s.number && (
                <div className="surah-detail" id={`surah-${s.number}`}>
                  <div
                    className="ayah-map"
                    aria-label={`${s.name} memorized ayahs`}
                  >
                    {Array.from({ length: s.ayahs }, (_, i) => {
                      const learned = unionRanges(s.records).some(
                        (r) => i + 1 >= r.start && i + 1 <= r.end,
                      );
                      return (
                        <span
                          key={i}
                          className={learned ? "learned" : ""}
                          title={`Ayah ${i + 1}: ${learned ? "memorized" : "not recorded"}`}
                        >
                          {i + 1}
                        </span>
                      );
                    })}
                  </div>
                  {s.records.length ? (
                    s.records
                      .sort((a, b) => a.start - b.start)
                      .map((m) => (
                        <div key={m.id} className="record-row">
                          <div>
                            <strong>
                              Ayahs {m.start}–{m.end}
                            </strong>
                            <small>
                              {prettyDate(m.date)} · Juz{" "}
                              {rangeJuz(m).join(", ")}
                              {settings.mushaf === "medina-604"
                                ? ` · Medina 604 pp. ${rangePages(m)}`
                                : ""}
                            </small>
                            {role === "owner" &&
                              data.privateNotes.find(
                                (n) => n.id === `m_${m.id}`,
                              )?.text && (
                                <p className="private-note">
                                  Private:{" "}
                                  {
                                    data.privateNotes.find(
                                      (n) => n.id === `m_${m.id}`,
                                    )?.text
                                  }
                                </p>
                              )}
                          </div>
                          <span
                            className={`pill ${m.confidence === "needs-practice" ? "warning" : ""}`}
                          >
                            {qualityLabel(m.confidence)}
                          </span>
                          {role === "owner" && (
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={`Edit ${s.name} ayahs ${m.start} to ${m.end}`}
                                onClick={() => setForm(m)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Delete ${s.name} ayahs ${m.start} to ${m.end}`}
                                onClick={() => setRemove(m)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                  ) : (
                    <p className="muted">
                      No memorized ranges recorded for this Surah yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </Card>
      {form && (
        <SessionForm
          kind="memory"
          record={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {remove && (
        <Confirm
          title="Delete this memorized range?"
          busy={busy}
          onClose={() => setRemove(null)}
          onConfirm={() =>
            void run(
              () =>
                removeRecord(database(true), OWNER_UID, "memory", remove.id),
              "Range deleted.",
              () => setRemove(null),
            )
          }
        >
          Its session, schedule, and private note will be removed. Historical
          revision sessions will remain. Export a backup first if you may need
          to restore it.
        </Confirm>
      )}
    </>
  );
}
