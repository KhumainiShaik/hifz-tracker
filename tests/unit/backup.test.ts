import { describe, it, expect } from "vitest";
import {
  exportBackup,
  parseBackup,
  previewImport,
  migrateBackup,
} from "../../src/lib/backup";
import { emptyDataset } from "../../src/lib/models";
import { dataset, memory } from "../fixtures";
describe("versioned backups", () => {
  it("round-trips complete data, private notes and settings", () => {
    const d = dataset();
    expect(parseBackup(exportBackup(d))).toEqual(d);
  });
  it("rejects unknown versions, extra public fields, malformed input and invitations", () => {
    expect(() => parseBackup("{")).toThrow();
    expect(() => migrateBackup({ schemaVersion: 2 })).toThrow();
    const b = JSON.parse(exportBackup(dataset()));
    b.data.memorizedRanges[0].privateNote = "leak";
    expect(() => parseBackup(JSON.stringify(b))).toThrow();
    const c = JSON.parse(exportBackup(dataset()));
    c.data.viewerInvitations = [];
    expect(() => parseBackup(JSON.stringify(c))).toThrow();
  });
  it("rejects duplicate IDs, orphan schedules and mismatched mirrors", () => {
    const d = dataset();
    d.revisionSchedules[0].memoryId = "missing";
    expect(() => parseBackup(exportBackup(d))).toThrow();
    const e = dataset();
    e.memorizationSessions[0].end = 3;
    expect(() => parseBackup(exportBackup(e))).toThrow();
    const f = dataset();
    f.revisionSessions.push(f.revisionSessions[0]);
    expect(() => parseBackup(exportBackup(f))).toThrow();
  });
  it("previews a merge without changing current data or granting permissions", () => {
    const d = dataset();
    const original = JSON.stringify(d);
    const p = previewImport(d, parseBackup(exportBackup(d)));
    expect(p.added).toBe(0);
    expect(p.skipped).toBe(2);
    expect(p.data.privateNotes).toHaveLength(0);
    expect(JSON.stringify(d)).toBe(original);
    expect(previewImport(emptyDataset(), d).added).toBe(2);
  });
  it("skips equivalent activities with different IDs, preserving current IDs", () => {
    const current = dataset();
    const incoming = dataset();
    incoming.memorizedRanges = [memory({ id: "old" })];
    incoming.memorizationSessions = [memory({ id: "old" })];
    incoming.revisionSessions = [];
    incoming.revisionSchedules = [];
    incoming.privateNotes = [];
    expect(previewImport(current, incoming).added).toBe(0);
  });
  it("keeps current conflicting records instead of silently overwriting", () => {
    const current = dataset(),
      incoming = dataset();
    incoming.memorizedRanges[0].confidence = "strong";
    incoming.memorizationSessions[0].confidence = "strong";
    const p = previewImport(current, incoming);
    expect(p.conflicts).toBe(1);
    expect(p.data.memorizedRanges).toEqual([]);
  });
  it("rejects duplicate natural sessions and orphan notes", () => {
    const d = dataset();
    d.memorizedRanges.push(memory({ id: "duplicate" }));
    d.memorizationSessions.push(memory({ id: "duplicate" }));
    expect(() => parseBackup(exportBackup(d))).toThrow();
    const e = dataset();
    e.privateNotes[0].id = "m_missing";
    expect(() => parseBackup(exportBackup(e))).toThrow();
  });
});
