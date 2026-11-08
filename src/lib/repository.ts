import {
  collection,
  doc,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import type {
  DocumentData,
  Firestore,
  QuerySnapshot,
  WriteBatch,
} from "firebase/firestore";
import {
  collectionSchemas,
  emptyDataset,
  baseRecord,
  profileSchema,
} from "./models";
import type {
  Dataset,
  Memory,
  Revision,
  Settings,
  Invitation,
  Schedule,
  Note,
} from "./models";
import type { ImportPlan } from "./backup";
export const ownerPath = (uid: string) => `owners/${uid}`;
export function decode<T>(record: DocumentData, id: string): T {
  return {
    ...record,
    id,
    createdAt: record.createdAt?.toMillis?.() ?? 0,
    updatedAt: record.updatedAt?.toMillis?.() ?? 0,
  } as T;
}
export function records<T>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map((d) =>
    decode<T>(d.data({ serverTimestamps: "estimate" }), d.id),
  );
}
function stored(
  record: { id: string; createdAt: number; updatedAt: number },
  isNew: boolean,
  restore = false,
) {
  const { id, ...data } = record;
  void id;
  return {
    ...data,
    createdAt: restore
      ? Timestamp.fromMillis(data.createdAt)
      : isNew
        ? serverTimestamp()
        : Timestamp.fromMillis(data.createdAt),
    updatedAt: serverTimestamp(),
  };
}
function put(
  batch: WriteBatch,
  db: Firestore,
  uid: string,
  col: string,
  record: { id: string; createdAt: number; updatedAt: number },
  isNew: boolean,
  restore = false,
) {
  batch.set(
    doc(db, ownerPath(uid), col, record.id),
    stored(record, isNew, restore),
  );
}
export async function saveMemory(
  db: Firestore,
  uid: string,
  memory: Memory,
  note: string,
  isNew: boolean,
) {
  collectionSchemas.memorizedRanges.parse(memory);
  const batch = writeBatch(db);
  put(batch, db, uid, "memorizedRanges", memory, isNew);
  put(batch, db, uid, "memorizationSessions", memory, isNew);
  if (isNew)
    put(
      batch,
      db,
      uid,
      "revisionSchedules",
      {
        ...baseRecord(memory.id),
        memoryId: memory.id,
        paused: false,
        overrideDate: "",
      } as Schedule,
      true,
    );
  putNote(batch, db, uid, `m_${memory.id}`, note);
  await batch.commit();
}
function putNote(
  batch: WriteBatch,
  db: Firestore,
  uid: string,
  id: string,
  text: string,
) {
  if (text.trim())
    put(
      batch,
      db,
      uid,
      "privateNotes",
      { ...baseRecord(id), text: text.trim() } as Note,
      true,
    );
  else batch.delete(doc(db, ownerPath(uid), "privateNotes", id));
}
export async function saveRevision(
  db: Firestore,
  uid: string,
  revision: Revision,
  note: string,
  isNew: boolean,
) {
  collectionSchemas.revisionSessions.parse(revision);
  const batch = writeBatch(db);
  put(batch, db, uid, "revisionSessions", revision, isNew);
  putNote(batch, db, uid, `r_${revision.id}`, note);
  await batch.commit();
}
export async function removeRecord(
  db: Firestore,
  uid: string,
  kind: "memory" | "revision",
  id: string,
) {
  const batch = writeBatch(db);
  batch.delete(
    doc(
      db,
      ownerPath(uid),
      kind === "memory" ? "memorizedRanges" : "revisionSessions",
      id,
    ),
  );
  batch.delete(
    doc(
      db,
      ownerPath(uid),
      "privateNotes",
      `${kind === "memory" ? "m" : "r"}_${id}`,
    ),
  );
  if (kind === "memory") {
    batch.delete(doc(db, ownerPath(uid), "memorizationSessions", id));
    batch.delete(doc(db, ownerPath(uid), "revisionSchedules", id));
  }
  await batch.commit();
}
export async function saveSettings(
  db: Firestore,
  uid: string,
  settings: Settings,
  isNew: boolean,
) {
  collectionSchemas.settings.parse(settings);
  const batch = writeBatch(db);
  put(batch, db, uid, "settings", settings, isNew);
  put(
    batch,
    db,
    uid,
    "profile",
    profileSchema.parse({
      ...baseRecord("public"),
      displayName: "Abdul Khumaini Shaik",
      timeZone: settings.timeZone,
      dailyGoal: settings.dailyGoal,
      revisionGoal: settings.revisionGoal,
      intervals: settings.intervals,
    }),
    true,
  );
  await batch.commit();
}
export async function saveSchedule(
  db: Firestore,
  uid: string,
  schedule: Schedule,
  isNew = false,
) {
  collectionSchemas.revisionSchedules.parse(schedule);
  const batch = writeBatch(db);
  put(batch, db, uid, "revisionSchedules", schedule, isNew);
  await batch.commit();
}
export async function saveInvitation(
  db: Firestore,
  uid: string,
  invitation: Invitation,
  isNew: boolean,
) {
  const batch = writeBatch(db);
  put(batch, db, uid, "viewerInvitations", invitation, isNew);
  await batch.commit();
}
export function watchCollection<T>(
  db: Firestore,
  uid: string,
  name: string,
  onData: (rows: T[], pending: boolean, cached: boolean) => void,
  onError: (error: Error) => void,
) {
  if (name === "profile")
    return onSnapshot(
      doc(db, ownerPath(uid), "profile", "public"),
      { includeMetadataChanges: true },
      (s) =>
        onData(
          s.exists()
            ? [decode<T>(s.data({ serverTimestamps: "estimate" }), s.id)]
            : [],
          s.metadata.hasPendingWrites,
          s.metadata.fromCache,
        ),
      onError,
    );
  return onSnapshot(
    collection(db, ownerPath(uid), name),
    { includeMetadataChanges: true },
    (s) =>
      onData(records<T>(s), s.metadata.hasPendingWrites, s.metadata.fromCache),
    onError,
  );
}
export async function serverBackup(
  db: Firestore,
  uid: string,
): Promise<Dataset> {
  const output = emptyDataset();
  await Promise.all(
    (Object.keys(output) as (keyof Dataset)[]).map(async (key) => {
      const snapshot = await getDocsFromServer(
        collection(db, ownerPath(uid), key),
      );
      Object.assign(output, { [key]: records(snapshot) });
    }),
  );
  return output;
}
export async function applyImport(
  db: Firestore,
  uid: string,
  plan: ImportPlan,
  onProgress: (done: number, total: number) => void,
) {
  // Each memory group (range + session + schedule + note) is atomic. Existing records win.
  const groups: Array<
    Array<{
      col: keyof Dataset;
      record:
        | Memory
        | Revision
        | Schedule
        | Note
        | Settings
        | Dataset["profile"][number];
    }>
  > = [];
  const d = plan.data;
  for (const m of d.memorizedRanges) {
    const group = [
      { col: "memorizedRanges" as const, record: m },
      { col: "memorizationSessions" as const, record: m },
    ] as (typeof groups)[number];
    const schedule = d.revisionSchedules.find((s) => s.memoryId === m.id) ?? {
      ...baseRecord(m.id),
      memoryId: m.id,
      paused: false,
      overrideDate: "",
    };
    group.push({ col: "revisionSchedules", record: schedule });
    const note = d.privateNotes.find((n) => n.id === `m_${m.id}`);
    if (note) group.push({ col: "privateNotes", record: note });
    groups.push(group);
  }
  for (const r of d.revisionSessions) {
    const group: (typeof groups)[number] = [
      { col: "revisionSessions", record: r },
    ];
    const note = d.privateNotes.find((n) => n.id === `r_${r.id}`);
    if (note) group.push({ col: "privateNotes", record: note });
    groups.push(group);
  }
  let done = 0;
  for (let i = 0; i < groups.length; i += 5) {
    const batch = writeBatch(db);
    for (const group of groups.slice(i, i + 5))
      for (const item of group)
        put(batch, db, uid, item.col, item.record, true, true);
    await batch.commit();
    done += Math.min(5, groups.length - i);
    onProgress(done, groups.length);
  }
  if (d.settings[0]) await saveSettings(db, uid, d.settings[0], true);
}
