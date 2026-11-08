import { categoryForAge } from "../lib/analytics";
import { useState } from "react";
import type { FormEvent } from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { Modal, Field } from "./ui";
import { useData, useMutation, useToday } from "../lib/hooks";
import { SURAHS, validRange, rangeJuz, rangePages } from "../lib/quran";
import {
  baseRecord,
  memorySchema,
  revisionSchema,
  sessionKey,
} from "../lib/models";
import type { Memory, Revision } from "../lib/models";
import { database, OWNER_UID } from "../lib/firebase";
import { saveMemory, saveRevision } from "../lib/repository";
export function SessionForm({
  kind,
  record,
  memory,
  onClose,
}: {
  kind: "memory" | "revision";
  record?: Memory | Revision;
  memory?: Memory;
  onClose: () => void;
}) {
  const { data, settings } = useData();
  const today = useToday(settings.timeZone);
  const { busy, run } = useMutation();
  const initial = record ?? memory;
  const [surah, setSurah] = useState(initial?.surah ?? 1),
    [start, setStart] = useState(initial?.start ?? 1),
    [end, setEnd] = useState(initial?.end ?? 7);
  const [date, setDate] = useState(record?.date ?? today),
    [quality, setQuality] = useState<"strong" | "okay" | "needs-practice">(
      record && "quality" in record
        ? record.quality
        : record && "confidence" in record
          ? record.confidence
          : "okay",
    );
  const [category, setCategory] = useState<"sabaq" | "sabqi" | "manzil">(
    record && "category" in record
      ? record.category
      : memory
        ? categoryForAge(memory.date, today)
        : "sabqi",
  );
  const [memoryId, setMemoryId] = useState(
    record && "memoryId" in record ? record.memoryId : (memory?.id ?? ""),
  );
  const [nextReview, setNextReview] = useState(
    record && "nextReview" in record ? record.nextReview : "",
  );
  const [note, setNote] = useState(
    data.privateNotes.find(
      (n) => n.id === `${kind === "memory" ? "m" : "r"}_${record?.id}`,
    )?.text ?? "",
  );
  const [error, setError] = useState("");
  const range = { surah, start, end };
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (date > today)
        throw new Error(
          "Choose today or an earlier date for a completed session.",
        );
      const values = { ...range, date };
      const rows =
        kind === "memory" ? data.memorizedRanges : data.revisionSessions;
      const key = sessionKey(kind === "memory" ? "m" : "r", {
        ...values,
        category,
      });
      if (
        rows.some(
          (r) =>
            r.id !== record?.id &&
            sessionKey(kind === "memory" ? "m" : "r", r) === key,
        )
      )
        throw new Error(
          "This exact range has already been recorded for this date and category. Edit the existing session instead.",
        );
      const id =
        record?.id ??
        (rows.some((r) => r.id === key)
          ? `${key}_${crypto.randomUUID().slice(0, 8)}`
          : key);
      const base = record ?? baseRecord(id);
      if (kind === "memory") {
        const item = memorySchema.parse({
          ...base,
          ...values,
          confidence: quality,
        });
        void run(
          () => saveMemory(database(true), OWNER_UID, item, note, !record),
          "Memorization synchronized.",
          onClose,
        );
      } else {
        const item = revisionSchema.parse({
          ...base,
          ...values,
          category,
          quality,
          memoryId,
          nextReview: memoryId ? nextReview : "",
        });
        if (memoryId) {
          const linked = data.memorizedRanges.find((m) => m.id === memoryId);
          if (
            !linked ||
            linked.surah !== surah ||
            start > linked.start ||
            end < linked.end
          )
            throw new Error(
              "To advance this schedule, revise the entire linked memorized range. Choose Custom range for a partial revision.",
            );
        }
        void run(
          () => saveRevision(database(true), OWNER_UID, item, note, !record),
          "Revision synchronized.",
          onClose,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error && err.name === "ZodError"
          ? "Check the ayah range and dates. The next review must be after this session."
          : err instanceof Error
            ? err.message
            : "Check the form.",
      );
    }
  }
  function linkMemory(id: string) {
    setMemoryId(id);
    const m = data.memorizedRanges.find((m) => m.id === id);
    if (m) {
      setCategory(categoryForAge(m.date, today));
      setSurah(m.surah);
      setStart(m.start);
      setEnd(m.end);
    }
  }
  return (
    <Modal
      title={`${record ? "Edit" : kind === "memory" ? "Add" : "Log"} ${kind === "memory" ? "memorization" : "revision"}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <p className="muted">
          {kind === "memory"
            ? "Every ayah is a step forward. Record what you have memorized."
            : "Return to what you know. A little revision keeps it close."}
        </p>
        {kind === "revision" && (
          <Field
            label="Review a memorized range"
            hint="Only a full linked revision advances its schedule. Custom ranges are recorded as activity."
          >
            <select
              value={memoryId}
              onChange={(e) => linkMemory(e.target.value)}
            >
              <option value="">Custom range</option>
              {data.memorizedRanges.map((m) => (
                <option key={m.id} value={m.id}>
                  {SURAHS[m.surah - 1].name} · {m.start}–{m.end}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Surah">
          <select
            value={surah}
            onChange={(e) => {
              setSurah(Number(e.target.value));
              setStart(1);
              setEnd(1);
              setMemoryId("");
            }}
          >
            {SURAHS.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name} — {s.arabic} ({s.ayahs} ayahs)
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Starting ayah">
            <input
              type="number"
              min="1"
              max={SURAHS[surah - 1].ayahs}
              required
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
          </Field>
          <Field label="Ending ayah">
            <input
              type="number"
              min={start}
              max={SURAHS[surah - 1].ayahs}
              required
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
            />
          </Field>
        </div>
        {validRange(range) && (
          <div className="range-preview">
            <BookOpen size={17} />
            {end - start + 1} ayahs · Juz {rangeJuz(range).join(", ")}
            {settings.mushaf === "medina-604" &&
              ` · Medina 604, pp. ${rangePages(range)}`}
          </div>
        )}
        <div className="form-grid">
          <Field label="Session date">
            <input
              type="date"
              required
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={kind === "memory" ? "Confidence" : "Recall quality"}>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as typeof quality)}
            >
              <option value="strong">Strong</option>
              <option value="okay">Okay</option>
              <option value="needs-practice">Needs practice</option>
            </select>
          </Field>
        </div>
        {kind === "revision" && (
          <div className="form-grid">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
              >
                <option value="sabaq">Sabaq · new memorization</option>
                <option value="sabqi">Sabqi · recent memorization</option>
                <option value="manzil">Manzil · older memorization</option>
              </select>
            </Field>
            <Field
              label="Next review (optional)"
              hint="Select a memorized range to set its next review."
            >
              <input
                type="date"
                disabled={!memoryId}
                value={memoryId ? nextReview : ""}
                min={date}
                onChange={(e) => setNextReview(e.target.value)}
              />
            </Field>
          </div>
        )}
        <Field
          label="Private notes (optional)"
          hint="Only you can read these notes. Viewers cannot retrieve them."
        >
          <textarea
            maxLength={4000}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What felt easy? What needs a little more time?"
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span className="privacy-note">
            <ShieldCheck size={15} /> Saved securely
          </span>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Waiting for sync…" : "Save session"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
