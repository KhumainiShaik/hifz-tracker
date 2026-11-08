import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import {
  saveMemory,
  saveRevision,
  saveSettings,
  saveInvitation,
  saveSchedule,
  removeRecord,
  serverBackup,
  applyImport,
} from "../../src/lib/repository";
import { defaultSettings, baseRecord } from "../../src/lib/models";
import { parseBackup, exportBackup, previewImport } from "../../src/lib/backup";
import { memory, revision, dataset } from "../fixtures";
let env: RulesTestEnvironment;
const uid = "test-owner";
const root = `owners/${uid}`;
const claims = (
  email: string,
  verified = true,
  provider: "google.com" | "password" | "anonymous" = "google.com",
) => ({
  email,
  email_verified: verified,
  firebase: { sign_in_provider: provider },
});
const owner = () =>
  env
    .authenticatedContext(uid, claims("abdul@example.com"))
    .firestore() as unknown as Firestore;
const viewer = () =>
  env
    .authenticatedContext("viewer-uid", claims("teacher@example.com"))
    .firestore() as unknown as Firestore;
const ref = (db: Firestore, col = "memorizedRanges", id = "m1") =>
  doc(db, root, col, id);
function stored<T extends { id: string; createdAt: number; updatedAt: number }>(
  value: T,
) {
  const { id, ...rest } = value;
  void id;
  return {
    ...rest,
    createdAt: Timestamp.fromMillis(rest.createdAt),
    updatedAt: Timestamp.fromMillis(rest.updatedAt),
  };
}
beforeAll(async () => {
  const rules = readFileSync("firestore.rules", "utf8").replace(
    "return '__OWNER_UID_NOT_CONFIGURED__';",
    `return '${uid}';`,
  );
  env = await initializeTestEnvironment({
    projectId: "demo-hifz-tracker",
    firestore: { host: "127.0.0.1", port: 8080, rules },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const d = dataset();
    for (const [col, rows] of Object.entries(d))
      for (const row of rows) await setDoc(ref(db, col, row.id), stored(row));
    await setDoc(
      ref(db, "profile", "public"),
      stored({
        ...baseRecord("public"),
        displayName: "Abdul Khumaini Shaik",
        timeZone: "Asia/Kolkata",
        dailyGoal: 5,
        revisionGoal: 2,
        intervals: [1, 3, 7, 14, 30],
      }),
    );
    for (const email of ["teacher@example.com", "family@example.com"])
      await setDoc(
        ref(db, "viewerInvitations", email),
        stored({ ...baseRecord(email), email, status: "active" }),
      );
  });
});
afterAll(async () => {
  await env.cleanup();
});
describe("owner access and real client operations", () => {
  it("owner reads all progress and private collections", async () => {
    for (const col of [
      "memorizedRanges",
      "memorizationSessions",
      "revisionSessions",
      "revisionSchedules",
      "profile",
      "privateNotes",
      "settings",
      "viewerInvitations",
    ])
      await assertSucceeds(getDocsFromServer(collection(owner(), root, col)));
  });
  it("owner creates and edits a memorization with an atomic mirror and private note", async () => {
    const db = owner();
    await assertSucceeds(
      saveMemory(
        db,
        uid,
        memory({ id: "new", surah: 2, end: 5 }),
        "Only the owner can read this.",
        true,
      ),
    );
    const saved = await getDocFromServer(ref(db, "memorizedRanges", "new"));
    expect(saved.data()?.end).toBe(5);
    await assertSucceeds(
      saveMemory(
        db,
        uid,
        memory({
          id: "new",
          surah: 2,
          end: 8,
          createdAt: saved.data()!.createdAt.toMillis(),
        }),
        "Updated private note.",
        false,
      ),
    );
    expect(
      (await getDocFromServer(ref(db, "memorizationSessions", "new"))).data()
        ?.end,
    ).toBe(8);
  });
  it("owner deletes memory, mirror, schedule and note", async () => {
    await assertSucceeds(removeRecord(owner(), uid, "memory", "m1"));
    expect((await getDocFromServer(ref(owner()))).exists()).toBe(false);
    expect(
      (await getDocFromServer(ref(owner(), "privateNotes", "m_m1"))).exists(),
    ).toBe(false);
  });
  it("owner saves, edits and deletes revisions", async () => {
    const db = owner();
    await assertSucceeds(
      saveRevision(
        db,
        uid,
        revision({ id: "new-revision" }),
        "Private recall note",
        true,
      ),
    );
    const snap = await getDocFromServer(
      ref(db, "revisionSessions", "new-revision"),
    );
    await assertSucceeds(
      saveRevision(
        db,
        uid,
        revision({
          id: "new-revision",
          quality: "needs-practice",
          createdAt: snap.data()!.createdAt.toMillis(),
        }),
        "Updated",
        false,
      ),
    );
    await assertSucceeds(removeRecord(db, uid, "revision", "new-revision"));
  });
  it("owner can change settings and the shared goal profile together", async () => {
    await assertSucceeds(
      saveSettings(
        owner(),
        uid,
        { ...defaultSettings(), dailyGoal: 12, intervals: [2, 4, 10] },
        true,
      ),
    );
    expect(
      (await getDocFromServer(ref(viewer(), "profile", "public"))).data()
        ?.dailyGoal,
    ).toBe(12);
  });
  it("owner can grant, revoke and restore invitations using client operations", async () => {
    const db = owner(),
      i = {
        ...baseRecord("new@example.com"),
        email: "new@example.com",
        status: "active" as const,
      };
    await assertSucceeds(saveInvitation(db, uid, i, true));
    const snap = await getDocFromServer(ref(db, "viewerInvitations", i.email));
    await assertSucceeds(
      saveInvitation(
        db,
        uid,
        {
          ...i,
          createdAt: snap.data()!.createdAt.toMillis(),
          status: "revoked",
        },
        false,
      ),
    );
  });
  it("owner can export, validate, and re-import idempotently", async () => {
    const db = owner();
    const backup = parseBackup(exportBackup(await serverBackup(db, uid)));
    await env.clearFirestore();
    const plan = previewImport(await serverBackup(db, uid), backup);
    await assertSucceeds(applyImport(db, uid, plan, () => {}));
    expect(
      (await getDocsFromServer(collection(db, root, "memorizedRanges"))).size,
    ).toBe(1);
    const again = previewImport(await serverBackup(db, uid), backup);
    expect(again.added).toBe(0);
  });
  it("imports a multi-batch backup within rule access limits", async () => {
    const db = owner();
    const incoming = dataset();
    incoming.memorizedRanges = Array.from({ length: 12 }, (_, i) =>
      memory({ id: `import${i}`, surah: 2, start: i + 1, end: i + 1 }),
    );
    incoming.memorizationSessions = incoming.memorizedRanges;
    incoming.revisionSessions = [];
    incoming.revisionSchedules = [];
    incoming.privateNotes = [];
    await assertSucceeds(
      applyImport(
        db,
        uid,
        previewImport(await serverBackup(db, uid), incoming),
        () => {},
      ),
    );
    expect(
      (await getDocsFromServer(collection(db, root, "memorizedRanges"))).size,
    ).toBe(13);
  });
});
describe("verified viewer read-only access", () => {
  it("invited viewer can run actual progress queries and read public profile", async () => {
    const db = viewer();
    for (const col of [
      "memorizedRanges",
      "memorizationSessions",
      "revisionSessions",
      "revisionSchedules",
    ])
      await assertSucceeds(getDocsFromServer(collection(db, root, col)));
    await assertSucceeds(getDocFromServer(ref(db, "profile", "public")));
  });
  it("viewer cannot create, edit or delete progress", async () => {
    const db = viewer();
    await assertFails(
      saveMemory(db, uid, memory({ id: "unauthorized" }), "", true),
    );
    await assertFails(
      updateDoc(ref(db), { end: 3, updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(ref(db)));
    await assertFails(
      saveRevision(db, uid, revision({ id: "unauthorized-review" }), "", true),
    );
  });
  it("uninvited user cannot read records or run queries", async () => {
    const db = env
      .authenticatedContext("stranger", claims("stranger@example.com"))
      .firestore() as unknown as Firestore;
    await assertFails(getDocFromServer(ref(db)));
    await assertFails(
      getDocsFromServer(collection(db, root, "memorizedRanges")),
    );
  });
  it("revoked viewer fails subsequent server reads, including already-seen documents", async () => {
    const db = viewer();
    await assertSucceeds(getDocFromServer(ref(db)));
    await updateDoc(ref(owner(), "viewerInvitations", "teacher@example.com"), {
      status: "revoked",
      updatedAt: serverTimestamp(),
    });
    await assertFails(getDocFromServer(ref(db)));
    await assertFails(
      getDocsFromServer(collection(db, root, "revisionSessions")),
    );
  });
  it("anonymous and signed-out users cannot read private or public progress", async () => {
    for (const db of [
      env.unauthenticatedContext().firestore(),
      env
        .authenticatedContext("anon", {
          firebase: { sign_in_provider: "anonymous" },
        })
        .firestore(),
    ]) {
      await assertFails(getDocFromServer(ref(db as unknown as Firestore)));
      await assertFails(
        getDocFromServer(
          ref(db as unknown as Firestore, "privateNotes", "m_m1"),
        ),
      );
    }
  });
  it("viewer gets own invitation only, with no email enumeration", async () => {
    await assertSucceeds(
      getDocFromServer(
        ref(viewer(), "viewerInvitations", "teacher@example.com"),
      ),
    );
    await assertFails(
      getDocFromServer(
        ref(viewer(), "viewerInvitations", "family@example.com"),
      ),
    );
    await assertFails(
      getDocsFromServer(collection(viewer(), root, "viewerInvitations")),
    );
  });
  it("uninvited users can check only their own status, not whether others are invited", async () => {
    const db = env
      .authenticatedContext("stranger", claims("stranger@example.com"))
      .firestore() as unknown as Firestore;
    const own = await assertSucceeds(
      getDocFromServer(ref(db, "viewerInvitations", "stranger@example.com")),
    );
    expect(own.exists()).toBe(false);
    await assertFails(
      getDocFromServer(ref(db, "viewerInvitations", "teacher@example.com")),
    );
  });
  it("viewer cannot manage permissions or self-promote", async () => {
    await assertFails(
      updateDoc(ref(viewer(), "viewerInvitations", "teacher@example.com"), {
        status: "active",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(setDoc(doc(viewer(), root), { role: "owner" }));
    await assertFails(
      setDoc(doc(viewer(), "roles", "viewer-uid"), { role: "owner" }),
    );
  });
  it("private notes and private settings are owner-only", async () => {
    await assertFails(getDocFromServer(ref(viewer(), "privateNotes", "m_m1")));
    await assertFails(
      getDocsFromServer(collection(viewer(), root, "privateNotes")),
    );
    await assertFails(
      getDocFromServer(ref(viewer(), "settings", "preferences")),
    );
    await assertFails(saveSettings(viewer(), uid, defaultSettings(), false));
  });
  it("rejects unverified email and non-Google sign-in even for invited email", async () => {
    for (const claimsValue of [
      claims("teacher@example.com", false),
      claims("teacher@example.com", true, "password"),
    ]) {
      const db = env
        .authenticatedContext("imposter", claimsValue)
        .firestore() as unknown as Firestore;
      await assertFails(getDocFromServer(ref(db)));
      await assertFails(
        getDocFromServer(ref(db, "viewerInvitations", "teacher@example.com")),
      );
    }
  });
  it("matches mixed-case token emails but does not fold dot or plus aliases", async () => {
    await assertSucceeds(
      getDocFromServer(
        ref(
          env
            .authenticatedContext("mixed", claims("Teacher@Example.COM"))
            .firestore() as unknown as Firestore,
        ),
      ),
    );
    for (const email of ["tea.cher@example.com", "teacher+alias@example.com"])
      await assertFails(
        getDocFromServer(
          ref(
            env
              .authenticatedContext("other", claims(email))
              .firestore() as unknown as Firestore,
          ),
        ),
      );
  });
  it("supports an invitation created before the viewer first signs in", async () => {
    const email = "future@example.com";
    await saveInvitation(
      owner(),
      uid,
      { ...baseRecord(email), email, status: "active" },
      true,
    );
    const db = env
      .authenticatedContext("brand-new-uid", claims(email))
      .firestore() as unknown as Firestore;
    await assertSucceeds(getDocFromServer(ref(db)));
  });
  it("cross-owner paths and client-controlled ownership are denied", async () => {
    for (const db of [
      owner(),
      viewer(),
      env
        .authenticatedContext("other-owner", claims("abdul@example.com"))
        .firestore() as unknown as Firestore,
    ]) {
      await assertFails(
        getDocFromServer(doc(db, "owners/another/memorizedRanges/x")),
      );
      await assertFails(
        setDoc(doc(db, "owners/another/memorizedRanges/x"), stored(memory())),
      );
    }
    await assertFails(
      getDocFromServer(
        ref(
          env
            .authenticatedContext("other-owner", claims("abdul@example.com"))
            .firestore() as unknown as Firestore,
        ),
      ),
    );
  });
});
describe("strict field validation", () => {
  it("rejects out-of-bounds ayahs, reversed ranges and injected notes in progress", async () => {
    for (const fields of [
      { surah: 115 },
      { surah: 1, end: 8 },
      { start: 4, end: 2 },
      { privateNotes: "leak" },
      { role: "owner" },
      { confidence: "perfect" },
    ]) {
      const db = owner(),
        batch = writeBatch(db),
        value = {
          ...stored(memory({ id: "invalid" })),
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      batch.set(ref(db, "memorizedRanges", "invalid"), value);
      batch.set(ref(db, "memorizationSessions", "invalid"), value);
      await assertFails(batch.commit());
    }
  });
  it("requires atomic consistency between a range and its activity mirror", async () => {
    await assertFails(
      updateDoc(ref(owner()), { end: 3, updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(ref(owner())));
  });
  it("rejects changed creation timestamps", async () => {
    const db = owner(),
      batch = writeBatch(db);
    for (const col of ["memorizedRanges", "memorizationSessions"])
      batch.update(ref(db, col, "m1"), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    await assertFails(batch.commit());
  });
  it("rejects invalid intervals and unknown settings fields", async () => {
    await assertFails(
      updateDoc(ref(owner(), "settings", "preferences"), {
        intervals: [7, 1],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref(owner(), "settings", "preferences"), {
        role: "owner",
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("rejects orphan schedules and mismatched invitation email", async () => {
    await assertFails(
      saveSchedule(
        owner(),
        uid,
        {
          ...baseRecord("missing"),
          memoryId: "missing",
          paused: false,
          overrideDate: "",
        },
        true,
      ),
    );
    await assertFails(
      setDoc(ref(owner(), "viewerInvitations", "someone@example.com"), {
        ...stored({
          ...baseRecord("x"),
          email: "other@example.com",
          status: "active",
        }),
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("permits supported punctuation in exact email IDs", async () => {
    const email = "teacher.name+hifz@example.com";
    await assertSucceeds(
      saveInvitation(
        owner(),
        uid,
        { ...baseRecord(email), email, status: "active" },
        true,
      ),
    );
    await assertSucceeds(
      getDocFromServer(
        ref(
          env
            .authenticatedContext("alias", claims(email))
            .firestore() as unknown as Firestore,
        ),
      ),
    );
  });
});
describe("safe unconfigured onboarding", () => {
  it("the checked-in sentinel template grants no ownership even to a matching client UID", async () => {
    const locked = await initializeTestEnvironment({
      projectId: "demo-hifz-tracker",
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
    try {
      await assertFails(getDocFromServer(ref(owner())));
      await assertFails(
        saveMemory(owner(), uid, memory({ id: "locked" }), "", true),
      );
      const sentinel = locked
        .authenticatedContext(
          "__OWNER_UID_NOT_CONFIGURED__",
          claims("abdul@example.com"),
        )
        .firestore() as unknown as Firestore;
      await assertFails(
        getDocFromServer(
          doc(
            sentinel,
            "owners/__OWNER_UID_NOT_CONFIGURED__/memorizedRanges/m1",
          ),
        ),
      );
    } finally {
      await locked.cleanup();
    }
  });
});
