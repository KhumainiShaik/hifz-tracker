import { describe, it, expect } from "vitest";
import {
  SURAHS,
  validRange,
  uniqueAyahs,
  unionRanges,
  juzProgress,
  rangeJuz,
  rangePages,
} from "../../src/lib/quran";
import { dateInZone, addDays, validDate } from "../../src/lib/dates";
import {
  analytics,
  goalProgress,
  streaks,
  newlyMemorized,
} from "../../src/lib/analytics";
import { nextReview, revisionQueue } from "../../src/lib/scheduling";
import {
  normalizeEmail,
  memorySchema,
  settingsSchema,
  defaultSettings,
  baseRecord,
} from "../../src/lib/models";
import { memory, revision } from "../fixtures";
describe("verified Quran structure", () => {
  it("contains 114 Surahs with 6,236 ayahs and contiguous offsets", () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, s) => n + s.ayahs, 0)).toBe(6236);
    for (let i = 1; i < SURAHS.length; i++)
      expect(SURAHS[i].offset).toBe(SURAHS[i - 1].offset + SURAHS[i - 1].ayahs);
  });
  it.each([
    { surah: 0, start: 1, end: 1 },
    { surah: 115, start: 1, end: 1 },
    { surah: 1, start: 0, end: 3 },
    { surah: 1, start: 3, end: 2 },
    { surah: 1, start: 1, end: 8 },
    { surah: 1.5, start: 1, end: 1 },
    { surah: 2, start: 1.1, end: 5 },
  ])("rejects invalid range %o", (r) => expect(validRange(r)).toBe(false));
  it("validates a complete Surah and schema", () => {
    expect(validRange({ surah: 2, start: 1, end: 286 })).toBe(true);
    expect(memorySchema.safeParse(memory({ end: 8 })).success).toBe(false);
  });
  it("unions overlap, adjacency, nesting, repetition and preserves independent Surahs", () => {
    const ranges = [
      { surah: 2, start: 1, end: 10 },
      { surah: 2, start: 5, end: 15 },
      { surah: 2, start: 6, end: 7 },
      { surah: 2, start: 16, end: 20 },
      { surah: 2, start: 1, end: 10 },
      { surah: 1, start: 1, end: 7 },
    ];
    expect(uniqueAyahs(ranges)).toBe(27);
    expect(unionRanges(ranges)).toEqual([
      { surah: 1, start: 1, end: 7 },
      { surah: 2, start: 1, end: 20 },
    ]);
    expect(ranges[0].end).toBe(10);
  });
  it("uses actual Juz boundaries, including Surah splits", () => {
    const coverage = juzProgress([
      { surah: 1, start: 1, end: 7 },
      { surah: 2, start: 1, end: 141 },
    ]);
    expect(coverage[0]).toMatchObject({
      total: 148,
      memorized: 148,
      percent: 100,
    });
    expect(coverage[1].memorized).toBe(0);
    expect(rangeJuz({ surah: 2, start: 141, end: 142 })).toEqual([1, 2]);
    expect(juzProgress([]).reduce((n, j) => n + j.total, 0)).toBe(6236);
    expect(juzProgress([])[29].total).toBe(564);
  });
  it("maps only known Medina Mushaf pages", () => {
    expect(rangePages({ surah: 1, start: 1, end: 7 })).toBe("1");
    expect(rangePages({ surah: 2, start: 1, end: 5 })).toBe("2");
    expect(rangePages({ surah: 114, start: 1, end: 6 })).toBe("604");
  });
  it("full Quran coverage produces exactly 30 complete Juz", () => {
    const full = SURAHS.map((s) => ({
      surah: s.number,
      start: 1,
      end: s.ayahs,
    }));
    expect(uniqueAyahs(full)).toBe(6236);
    expect(juzProgress(full).every((j) => j.percent === 100)).toBe(true);
  });
});
describe("dates, streaks, goals and analytics", () => {
  it("handles Kolkata midnight and DST without host-zone dependence", () => {
    expect(dateInZone(new Date("2026-01-01T18:29:59Z"), "Asia/Kolkata")).toBe(
      "2026-01-01",
    );
    expect(dateInZone(new Date("2026-01-01T18:30:00Z"), "Asia/Kolkata")).toBe(
      "2026-01-02",
    );
    expect(
      dateInZone(new Date("2026-03-08T07:30:00Z"), "America/New_York"),
    ).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("rejects rolled-over calendar dates", () => {
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2026-13-01")).toBe(false);
  });
  it("deduplicates activity days and keeps yesterday’s streak alive", () => {
    expect(
      streaks(
        ["2026-01-01", "2026-01-01", "2026-01-02", "2026-01-03"],
        "2026-01-04",
      ),
    ).toEqual({ current: 3, longest: 3 });
    expect(
      streaks(["2026-01-01", "2026-01-03", "2026-01-04"], "2026-01-06"),
    ).toEqual({ current: 0, longest: 2 });
    expect(streaks([], "2026-01-01")).toEqual({ current: 0, longest: 0 });
  });
  it("caps goal percentages and handles zero safely", () => {
    expect(goalProgress(7, 5)).toBe(100);
    expect(goalProgress(2, 5)).toBe(40);
    expect(goalProgress(2, 0)).toBe(0);
  });
  it("distinguishes activity from new coverage and ignores duplicate sessions", () => {
    const first = memory({ start: 1, end: 5 }),
      second = memory({ id: "m2", start: 3, end: 7, date: "2026-01-02" });
    const a = analytics(
      [first, second, { ...second, id: "duplicate" }],
      [revision(), revision({ id: "duplicate-review" })],
      "2026-01-02",
    );
    expect(a.unique).toBe(7);
    expect(a.todayAyahs).toBe(2);
    expect(a.todayRevisions).toBe(1);
    expect(a.todaySessions).toBe(2);
    expect(newlyMemorized([first, second], "2026-01-02", "2026-01-02")).toBe(2);
  });
  it("reports month over month growth using unique gains", () => {
    const a = analytics(
      [
        memory({ date: "2025-12-31", end: 4 }),
        memory({ id: "m2", date: "2026-01-01", start: 3, end: 7 }),
      ],
      [],
      "2026-01-02",
    );
    expect(a.previousNew).toBe(4);
    expect(a.monthNew).toBe(3);
    expect(a.monthChange).toBe(-1);
  });
});
describe("deterministic revision scheduling", () => {
  const intervals = [1, 3, 7, 14, 30];
  it("starts at the first gap and advances on Strong", () => {
    expect(nextReview(memory(), [], intervals, "2026-01-02")?.due).toBe(
      "2026-01-02",
    );
    expect(
      nextReview(memory(), [revision()], intervals, "2026-01-03")?.due,
    ).toBe("2026-01-05");
  });
  it("Okay repeats, Needs Practice resets, duplicate reviews do not advance twice", () => {
    expect(
      nextReview(
        memory(),
        [revision({ quality: "okay" })],
        intervals,
        "2026-01-02",
      )?.due,
    ).toBe("2026-01-03");
    expect(
      nextReview(
        memory(),
        [
          revision(),
          revision({ id: "r2", date: "2026-01-05", quality: "needs-practice" }),
        ],
        intervals,
        "2026-01-05",
      )?.due,
    ).toBe("2026-01-06");
    expect(
      nextReview(
        memory(),
        [revision(), revision({ id: "duplicate" })],
        intervals,
        "2026-01-02",
      )?.step,
    ).toBe(1);
  });
  it("replays unordered history and honors explicit dates", () => {
    const r2 = revision({
      id: "r2",
      date: "2026-01-05",
      nextReview: "2026-02-01",
    });
    expect(
      nextReview(memory(), [r2, revision()], intervals, "2026-01-06"),
    ).toEqual(nextReview(memory(), [revision(), r2], intervals, "2026-01-06"));
    expect(nextReview(memory(), [r2], intervals, "2026-01-06")?.due).toBe(
      "2026-02-01",
    );
  });
  it("respects manual dates, paused schedules and full-range reviews", () => {
    const control = {
      ...baseRecord("m1"),
      memoryId: "m1",
      paused: false,
      overrideDate: "2026-03-01",
    };
    expect(
      nextReview(memory(), [revision()], intervals, "2026-01-02", control)?.due,
    ).toBe("2026-03-01");
    expect(
      nextReview(memory(), [], intervals, "2026-01-02", {
        ...control,
        paused: true,
      }),
    ).toBeNull();
    expect(
      nextReview(memory(), [revision({ end: 3 })], intervals, "2026-01-02")
        ?.step,
    ).toBe(0);
    expect(
      nextReview(
        memory(),
        [revision({ memoryId: "" })],
        intervals,
        "2026-01-02",
      )?.step,
    ).toBe(0);
  });
  it("produces one queue entry per memorized range and recomputes after deletion", () => {
    expect(
      revisionQueue([memory()], [revision()], [], intervals, "2026-01-10"),
    ).toHaveLength(1);
    expect(nextReview(memory(), [], [2, 5], "2026-01-10")?.due).toBe(
      "2026-01-03",
    );
  });
});
describe("preferences and invitations", () => {
  it("rejects invalid intervals and time zones", () => {
    expect(
      settingsSchema.safeParse({ ...defaultSettings(), intervals: [3, 1] })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...defaultSettings(),
        timeZone: "Imaginary/Moon",
      }).success,
    ).toBe(false);
  });
  it("lowercases and trims while preserving Google email identity", () => {
    expect(normalizeEmail("  Teacher.Name+HIFZ@gmail.com ")).toBe(
      "teacher.name+hifz@gmail.com",
    );
    expect(normalizeEmail("a.b@gmail.com")).not.toBe(
      normalizeEmail("ab@gmail.com"),
    );
    expect(() => normalizeEmail("invalid/name@gmail.com")).toThrow();
    expect(() => normalizeEmail("bad")).toThrow();
  });
});
