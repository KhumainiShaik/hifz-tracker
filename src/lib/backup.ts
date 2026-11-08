import { z } from "zod";
import { collectionSchemas, emptyDataset, sessionKey } from "./models";
import type { Dataset } from "./models";
const backupSchema = z
  .object({
    app: z.literal("khumaini-hifz"),
    schemaVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    data: z
      .object({
        memorizedRanges: z.array(collectionSchemas.memorizedRanges),
        memorizationSessions: z.array(collectionSchemas.memorizationSessions),
        revisionSessions: z.array(collectionSchemas.revisionSessions),
        revisionSchedules: z.array(collectionSchemas.revisionSchedules),
        privateNotes: z.array(collectionSchemas.privateNotes),
        settings: z.array(collectionSchemas.settings).max(1),
        profile: z.array(collectionSchemas.profile).max(1),
      })
      .strict(),
  })
  .strict();
export function exportBackup(data: Dataset): string {
  return JSON.stringify(
    backupSchema.parse({
      app: "khumaini-hifz",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data,
    }),
    null,
    2,
  );
}
/** Version dispatch is deliberately explicit. Unknown/newer versions never silently import. */
export function migrateBackup(value: unknown): unknown {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1
  )
    throw new Error(
      "Unsupported backup version. Use a version 1 Khumaini Hifz backup.",
    );
  return value;
}
export function parseBackup(text: string): Dataset {
  if (new TextEncoder().encode(text).byteLength > 15_000_000)
    throw new Error("Backup exceeds the 15 MB safety limit.");
  const backup = backupSchema.parse(migrateBackup(JSON.parse(text)));
  const data = backup.data;
  for (const [collection, records] of Object.entries(data)) {
    if (records.length > 25000)
      throw new Error("Too many records in one collection.");
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error(`Duplicate IDs in ${collection}.`);
    if (
      records.some(
        (r) =>
          r.createdAt > Date.now() + 60000 || r.updatedAt > Date.now() + 60000,
      )
    )
      throw new Error("Backup contains future timestamps.");
  }
  const memoryIds = new Set(data.memorizedRanges.map((m) => m.id));
  if (
    data.memorizationSessions.length !== data.memorizedRanges.length ||
    data.memorizationSessions.some(
      (s) =>
        JSON.stringify(s) !==
        JSON.stringify(data.memorizedRanges.find((m) => m.id === s.id)),
    )
  )
    throw new Error("Memorization sessions must match their saved ranges.");
  if (data.revisionSchedules.some((s) => !memoryIds.has(s.memoryId)))
    throw new Error("A schedule references a missing memorized range.");
  const noteIds = new Set([
    ...data.memorizedRanges.map((m) => `m_${m.id}`),
    ...data.revisionSessions.map((r) => `r_${r.id}`),
  ]);
  if (data.privateNotes.some((n) => !noteIds.has(n.id)))
    throw new Error("A note references a missing session.");
  if (
    data.settings.some((s) => s.id !== "preferences") ||
    data.profile.some((p) => p.id !== "public")
  )
    throw new Error("Invalid singleton document ID.");
  for (const kind of ["m", "r"] as const) {
    const records = kind === "m" ? data.memorizedRanges : data.revisionSessions;
    if (
      new Set(records.map((r) => sessionKey(kind, r))).size !== records.length
    )
      throw new Error("Backup contains duplicate session activity.");
  }
  return data;
}
export interface ImportPlan {
  data: Dataset;
  added: number;
  skipped: number;
  conflicts: number;
  settingsChanged: boolean;
}
/** Merge-only restore: existing IDs and equivalent activities win; never deletes live data. */
export function previewImport(current: Dataset, incoming: Dataset): ImportPlan {
  const data = emptyDataset();
  let added = 0,
    skipped = 0,
    conflicts = 0;
  const remapped = new Map<string, string>();
  for (const collection of ["memorizedRanges", "revisionSessions"] as const) {
    const kind = collection === "memorizedRanges" ? "m" : "r";
    for (const record of incoming[collection]) {
      const existing = current[collection].find(
        (r) =>
          r.id === record.id ||
          sessionKey(kind, r) === sessionKey(kind, record),
      );
      if (existing) {
        skipped++;
        if (JSON.stringify(existing) !== JSON.stringify(record)) conflicts++;
        if (kind === "m") remapped.set(record.id, existing.id);
        continue;
      }
      // Arrays have disjoint domain types; validation already ran above.
      if (collection === "memorizedRanges")
        data.memorizedRanges.push(record as Dataset["memorizedRanges"][number]);
      else {
        const revision = { ...record } as Dataset["revisionSessions"][number];
        revision.memoryId =
          remapped.get(revision.memoryId) ?? revision.memoryId;
        data.revisionSessions.push(revision);
      }
      added++;
    }
  }
  data.memorizationSessions = data.memorizedRanges.map((m) => ({ ...m }));
  const newMemory = new Set(data.memorizedRanges.map((m) => m.id));
  const newNotes = new Set([
    ...data.memorizedRanges.map((m) => `m_${m.id}`),
    ...data.revisionSessions.map((r) => `r_${r.id}`),
  ]);
  data.revisionSchedules = incoming.revisionSchedules.filter((s) =>
    newMemory.has(s.memoryId),
  );
  data.privateNotes = incoming.privateNotes.filter((n) => newNotes.has(n.id));
  data.settings = incoming.settings;
  data.profile = incoming.profile;
  return {
    data,
    added,
    skipped,
    conflicts,
    settingsChanged: incoming.settings.length > 0,
  };
}
