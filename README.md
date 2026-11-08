# Khumaini's Hifz Journey

**Abdul Khumaini Shaik's Hifz Tracker** — a personal, mobile-first Quran memorization application with Google sign-in, Firestore persistence, deterministic revision planning, and securely invited viewers.

Target production address: **https://khumainishaik.github.io/hifz-tracker/**

The application contains no sample progress and no runtime AI dependency. Without Firebase configuration it displays an honest setup screen. Signing in before the owner UID is configured reveals only the authenticated UID; it does not unlock the database. A deployed site alone does not mean Firebase is configured.

## Start here

Follow **[SETUP.md](SETUP.md)** from Firebase project creation through the first record, invitation, backup, and iPhone installation. Read **[ARCHITECTURE.md](ARCHITECTURE.md)** for schema, security, scheduling, caching, and recovery policies. See **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** for Quran metadata provenance and licensing.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Use Node 24 LTS (minimum 22.12) and Java 21 or later for the Firebase emulator. Open the printed URL ending in `/hifz-tracker/`. Fill `.env.local` with public Firebase web config to use a real project. Never add a service-account key. Never enable emulators in production.

## Features

- **Today:** actual unique ayahs, fully covered Juz, goals, streaks, revision queue, sessions and recent activity; useful empty states.
- **My Hifz:** all 114 Surahs, Arabic/transliterated names, searchable completion filters, ayah maps, ranges, confidence, optional private notes, editing and deletion. Correct overlap union; 30 Juz with unequal boundaries; explicitly labeled Medina 604-page mapping.
- **Revision:** Sabaq, Sabqi, Manzil; recall quality; custom and linked reviews; due and overdue queues; editable/deletable history; configurable gaps; schedule pauses and manual dates.
- **Insights:** unique growth, seven-day activity, month comparison, revision consistency, goals, streaks, attention areas and an 84-day activity calendar. Session activity and newly covered ayahs are distinct.
- **Settings:** owner-only goals, unit preference, Mushaf references, IANA time zone, appearance, intervals, server-confirmed JSON export, validated merge import with preview and confirmation.
- **Viewers:** invitations tied to verified Google token email; manual link copying; active/revoked management; owner UID enforced in deployed Rules. Viewers cannot change records or retrieve private notes, settings, or other invitations.
- **PWA:** project-scoped assets, icons, offline app shell, owner IndexedDB persistence, pending/cache indicators, and explicit update prompts. Viewer data uses memory caching.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run test:rules
npx playwright install chromium
npm run test:e2e
npm run build
```

Security tests use the `demo-hifz-tracker` emulator project, isolated test identities and data, and the same rules template compiled for a test UID. They never seed a production account. Browser tests also use emulators. The build checks project-base asset paths, manifest scope/start URL, icons, and service worker.

GitHub Actions runs type checking, lint, unit/UI tests, emulator security tests, browser tests, and a production build before Pages deployment. Pull requests get validation without deployment. Production Rules deploy separately through an authenticated local Firebase CLI; the Pages build needs no Firebase service account.

## Repository map

```text
src/
  components/       Accessible dialogs, shell, forms, Quran progress views
  contexts/         Auth, live Firestore data, notifications
  data/             Original Tanzil XML and reproducible metadata JSON
  lib/              Models, validation, data access, dates, analytics, scheduling, backups
  pages/            Today, Hifz, Revision, Insights, Settings, Viewers, safe Welcome
  styles.css        Responsive light/dark visual system + Tailwind integration
public/             PWA and Apple touch icons
scripts/            Rules generation, build validation, metadata and icon generation
tests/              Pure calculations, auth/UI, emulator Rules, browser journeys
.github/workflows/  Validated Pages deployment
firestore.rules     Locked source template; never permissive onboarding
firebase*.json      Emulator and separate production Rules configurations
```

## Backup and maintenance routine

1. Every month, and before deleting or importing data, connect and wait for **Up to date**.
2. Settings → **Export backup**. Keep at least the last three dated files in a private drive, plus one independent copy.
3. To recover, configure the correct owner, choose **Import backup**, inspect the preview, optionally restore preferences, and confirm. Existing records win. Retry an interrupted import; completed sessions are skipped.
4. Invitations are deliberately excluded. Reinvite people deliberately after moving projects.
5. Review monthly Dependabot updates, run the full checks, and merge maintained versions. Review Firebase usage and authorized domains periodically.

Backups include private notes and are unencrypted JSON. Store them privately. Revocation cannot recall downloaded, cached, exported, copied, or screenshotted data. See the architecture document for offline conflicts and free-tier scaling limits.

## Deployment status

Consult GitHub Actions and Firebase Console to verify your deployment. See `VERIFICATION.md` for the actual checks and deployment observations recorded during implementation. The setup workflow never reports a configured database or production authentication based solely on a successful frontend build.
