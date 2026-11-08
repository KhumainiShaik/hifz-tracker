import { baseRecord, defaultSettings, emptyDataset } from "../src/lib/models";
import type { Memory, Revision, Dataset } from "../src/lib/models";
const base = (id: string) => ({
  ...baseRecord(id),
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
});
export const memory = (changes: Partial<Memory> = {}): Memory => ({
  ...base("m1"),
  surah: 1,
  start: 1,
  end: 7,
  date: "2026-01-01",
  confidence: "okay",
  ...changes,
});
export const revision = (changes: Partial<Revision> = {}): Revision => ({
  ...base("r1"),
  surah: 1,
  start: 1,
  end: 7,
  date: "2026-01-02",
  category: "sabqi",
  quality: "strong",
  memoryId: "m1",
  nextReview: "",
  ...changes,
});
export function dataset(): Dataset {
  const data = emptyDataset();
  data.memorizedRanges = [memory()];
  data.memorizationSessions = [memory()];
  data.revisionSessions = [revision()];
  data.revisionSchedules = [
    { ...base("m1"), memoryId: "m1", paused: false, overrideDate: "" },
  ];
  data.privateNotes = [
    { ...base("m_m1"), text: "Isolated test note, never production data." },
  ];
  data.settings = [{ ...defaultSettings(), ...base("preferences") }];
  return data;
}
