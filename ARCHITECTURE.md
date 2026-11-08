# Architecture and operational policies

## Runtime

React + TypeScript + Vite, Tailwind CSS, Lucide icons, React Router HashRouter. GitHub Pages serves only static files under `/hifz-tracker/`. Firebase Authentication provides Google sign-in and Cloud Firestore holds authoritative progress. There are no Cloud Functions, server deployments, email delivery providers, analytics trackers, advertisements, or AI services. The app never fabricates production progress.

Dependencies are locked in `package-lock.json`. Node 24 and Java 21 are used in CI. Vitest/React Testing Library cover calculations and UI; Firebase Emulator Suite tests the actual production Rules template; Playwright exercises the real app against local emulators.

## Authoritative identity and startup

`VITE_OWNER_UID` is public browser configuration. `firestore.production.rules` independently embeds the same UID and is deployed using the Firebase CLI. The checked-in template contains a sentinel that denies all configured access. A missing browser UID exposes a Google sign-in and UID-copy screen only; it does not query or write progress.

Owner status requires the exact configured Firebase UID and a verified Google sign-in token. A display name, user-entered email, document role, URL, or modified browser configuration cannot grant ownership. Unknown collection paths deny all access.

Authenticated viewers are authorized by `request.auth.token.firebase.sign_in_provider == 'google.com'`, `email_verified == true`, the signed email claim, and an active invitation under the configured owner's path. Client checks improve UX; Rules enforce access independently.

## Schema version 1

All documents have `schemaVersion`, `createdAt`, and `updatedAt`. Firestore timestamps are used in storage; typed client models and JSON backups use epoch milliseconds. Writes use a server timestamp for `updatedAt`, checked against `request.time`. New session timestamps are server assigned; imports preserve old creation timestamps. Session creation timestamps are immutable on updates. Preference/profile/note replacements may reset creation time; they are current state, not audit records.

Document IDs are derived by the client or canonical singleton IDs; they are not stored a second time in Firestore. Every path is beneath `owners/{configuredOwnerUid}`:

| Collection / document | Purpose | Viewer access |
| --- | --- | --- |
| `profile/public` | Fixed owner name, goals, time zone, revision gaps | Exact document read |
| `settings/preferences` | Full preferences: goals, units, Mushaf, theme, time zone, gaps | Denied |
| `memorizedRanges/{id}` | Surah, start/end, memorization date, confidence | Read |
| `memorizationSessions/{id}` | Atomically mirrored memorization activity | Read |
| `revisionSessions/{id}` | Date, range, category, quality, linked memory ID, optional next date | Read |
| `revisionSchedules/{memoryId}` | One control record per memory: pause/manual date | Read |
| `privateNotes/m_{memoryId}` | Memorization note, max 4,000 characters | Denied |
| `privateNotes/r_{revisionId}` | Revision note, max 4,000 characters | Denied |
| `viewerInvitations/{normalizedEmail}` | Exact email and active/revoked status, timestamps | Own exact document only; no list |

Owner records do not need repeated `ownerId` fields: the authenticated UID, fixed deployment UID, and owner-scoped path establish the ownership relationship. Unknown fields on every writable document are rejected, preventing accidental private-note fields on publicly readable records. Surah counts, ayah ranges, enum values, dates, timestamps, allowed keys, numeric goals, and interval bounds/order are checked by Rules where expressible. Zod also validates full calendar dates and IANA zones before client/import writes. Firestore Rules check the date shape; only the owner can write those values.

The memory/activity duplication is deliberately small: it distinguishes coverage and session concepts while allowing future migration. Writes and deletes must atomically maintain identical records; Rules use `getAfter`/`existsAfter`. Notes and schedule controls are included in the same client batch. Deleting a memory removes its mirrored session, note, and schedule but preserves historical revision logs. Those logs still count as activity, but no longer advance a deleted schedule.

## Invitation privacy

Invitation IDs use the exact Google email after trimming surrounding whitespace and lowercasing ASCII. Rules use the signed token email's `.lower()`, so the lookup is compatible without a backend hash service. Dots, plus suffixes, and domains are never rewritten; a different token email is a different invitation. Only standard ASCII emails without slash characters are accepted. Document paths are not security boundaries by secrecy; Rules prevent reading other invitations and listing the collection.

A viewer may read their own active/revoked/missing invitation. They cannot enumerate other emails, create invitations, change status, or self-promote. An invitation created before first sign-in works because it is not tied to a previously seen viewer UID. No viewer profile or unnecessary personal data is collected.

The invitation URL is simply `#/invite`. It contains no email, bearer token, or privilege. Owners manually share it. A live listener on the viewer's own invitation removes the dashboard when revoked. Every subsequent server-authorized progress read also checks active status. Existing downloaded, exported, copied, screenshotted, or cached information cannot be recalled. Offline data cannot establish current authorization.

## Coverage and analytics

Tanzil's retained structural XML provides counts, Arabic/transliterated names, offsets, Juz starts, and Medina Mushaf page starts. Extraction is deterministic. Range validation uses the actual Surah count. `unionRanges` sorts ranges, merges overlap and adjacency within a Surah, and never mutates input. Unique ayahs are the sum of merged interval lengths.

Juz and page intersections use global ayah offsets with real partition endpoints. Total ayahs are 6,236; Juz lengths are not treated as equal. “Juz completed” means every ayah in that specific Juz has coverage. Page labels apply only to the specified 604-page Medina Mushaf. No memorized-page equivalence is invented.

Activity is a saved session, separate from newly covered ayahs. New coverage for a date/window is cumulative unique coverage through the end minus coverage before the window. Repeated/overlapping records do not inflate new progress. Activity calculations also deduplicate exact natural session signatures; editing changes the recomputed history. UI creation rejects an exact date/range/category duplicate. Initial IDs encode that signature, so repeated same-key creates cannot silently reset immutable creation timestamps. If a previously edited record occupies an old signature ID, a suffix preserves that record.

Streaks use explicit session calendar dates interpreted in the selected IANA zone. Backdated sessions keep their entered date when the zone changes. Today is derived from `Intl.DateTimeFormat`; date arithmetic uses UTC noon to avoid DST/midnight errors. An active streak may end today or yesterday; future dates are excluded. Longest streak deduplicates dates. Optional Islamic dates use browser Umm al-Qura support, with a moon-sighting caveat.

## Revision scheduling

Each memorization record has one schedule-control document with its same ID. Repeated records for the exact same Surah/ayah range produce only one effective queue entry: the most recently dated memorization supplies the anchor and control (creation time and ID break ties). Reviews linked to any of those repeated records are replayed from that anchor date. A re-recorded range therefore restarts its rhythm without duplicate scheduling. Distinct partially overlapping ranges remain separate study units; coverage analytics still union all overlap. Automatic next dates are derived by replaying saved revisions, not maintained by render-time writes. This avoids duplicated queue jobs, race-prone materialized schedules, and paid background services.

Default gaps are `[1,3,7,14,30]` days. These are configurable study preferences, not religious prescriptions. The first review is memory date + first gap. Qualifying revisions are linked to that memory ID and cover the entire current range; partial or custom revisions count as activity only. Revisions are sorted by date, creation time, and ID; duplicate natural signatures are ignored.

- Strong increments the interval index, capped at the final gap.
- Okay keeps the current interval index.
- Needs Practice resets it to zero.
- The next due date is the revision date plus the selected gap, unless that revision specifies its own next date.
- A schedule-control manual date overrides all automatic/explicit revision dates until cleared.
- Paused controls suppress queue entries; the owner can resume them.

Gaps are relative to the last revision, not cumulative offsets from initial memorization. The last interval repeats indefinitely. Changing intervals or editing/deleting a session deterministically recalculates queues. Category suggestions use age: up to 1 day Sabaq, up to 30 days Sabqi, otherwise Manzil; the actual revision category remains owner-selected.

## Offline, synchronization and conflicts

The app shell is precached by Workbox with project-scoped paths. Firebase endpoints and user data are not service-worker cached. A new worker prompts for refresh; refresh is disabled while Firestore reports pending writes. Save forms before accepting updates. Versioned precaches are cleaned on activation.

Firestore persistence is initialized only after identity is known: owners use supported IndexedDB multi-tab persistence, viewers use memory cache. No progress is stored solely in localStorage. Snapshot metadata exposes pending writes and cache origin. Offline writes queue through the Firebase SDK; success messages appear only after the batch commit promise is server acknowledged. Rejected writes display errors and roll back the SDK's optimistic state. Pending changes block sign-out, export, import, and worker update. An offline form may remain waiting; closing the form does not cancel an already queued write.

Firestore uses last-write-wins for concurrent updates to a single document. There is no collaborative text merge or cross-device edit locking. Use one editing device at a time, especially during imports. Independent session IDs usually avoid conflict. Imports read current server state first and preserve existing records; a concurrent change can reject a batch. Re-run safely after reviewing. Browser storage eviction can remove unsynchronized changes; keep the device online until acknowledgement. Sign-out clears rendered data, terminates the client and attempts to clear IndexedDB. Other open tabs can prevent physical cache deletion; close all tabs and clear site data on shared devices after confirming synchronization.

## Backups, imports and migration

Versioned JSON includes app marker, export time, all data collections except invitations, and explicit numeric timestamps. Export fetches server data and requires no pending local writes. The parser rejects unknown versions, extra fields, invalid ranges/dates, unsupported enums, malformed references, inconsistent activity mirrors, duplicate IDs/natural sessions, orphan notes/schedules, files over 15 MB, and collections over 25,000 records. This bounds browser work and protects accidental imports. Very large archives will need a deliberate future migration.

Import previews additions, skips and conflicts. Existing IDs or equivalent natural sessions win; imported revisions can remap a duplicate memory ID to its current counterpart. Notes restore only with newly added sessions. Settings restoration is optional and updates the public goal profile consistently. Invitations are never restored automatically.

Each imported memory group is atomic. Batches contain at most five session groups to stay within Firestore's Rules access-call limits. A large import is not globally atomic; confirmed batches remain on failure, and repeating the import skips them. Keep a pre-import backup and other devices idle. Version 1 passes through the explicit migration dispatcher; newer/unknown versions fail closed until a tested migration is implemented. Do not silently reinterpret old schemas.

## Cost and long-term scaling

The app queries owner-scoped collections without sorting/filter composites; ordering and analytics run locally. Private note text is excluded from indexing. Listeners attach once per authenticated session, not per render or route. Initial reads load complete personal history for exact analytics and offline access; updates stream changed documents. Invited users never subscribe to private collections.

Firestore's published free allowance includes 1 GiB storage, 50,000 reads/day, 20,000 writes/day and 20,000 deletes/day; other limits also apply. Rules-dependent reads can incur reads even when access is denied. Check the current [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) and Console usage. Several years of one person's modest daily sessions plus a few occasional viewers fit the intended design, but many viewers, frequent reloads, or high-volume logging can exhaust quota. No application can guarantee unlimited Spark usage. At larger scale, add monthly partitions/aggregates with tested reconciliation and paginated history before increasing readership. There is no paid managed-backup dependency.

## Release verification boundary

Build/unit/Rules/browser checks establish local behavior. Real Google OAuth, production Rules, persistence across actual devices, and Pages hosting must also be verified against the configured external project. Source preparation does not claim external configuration succeeded. `SETUP.md` contains the final manual acceptance checks; `VERIFICATION.md` records observed results.
