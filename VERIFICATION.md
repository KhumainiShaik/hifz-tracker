# Verification record

Date: **8 November 2026** (Asia/Kolkata).

## Observed checks

- Local TypeScript compilation: passed.
- Local ESLint: passed with zero warnings.
- Local Vitest / React Testing Library: **47 tests passed** across 4 files after the final coverage/scheduling fixes.
- Firestore Emulator Suite: **28 tests passed in GitHub Actions**. The tests run actual owner writes, queries, invitation/revocation checks, private-data denials, atomic consistency validation, and JSON restore through the production data-access layer.
- Playwright: **6 desktop/mobile browser journeys passed in GitHub Actions**, covering Google-provider emulator sign-in, genuine client saves, reload persistence, revisions, settings/themes, export/import, owner/viewer separation, revocation, invalid inputs, editing, and confirmed deletion.
- Production Vite build: passed. Build validation confirms `/hifz-tracker/` asset paths, PWA scope/start URL, icons, and service worker.
- Runtime dependency audit: **zero known vulnerabilities**, including high/critical. A compatible `@grpc/grpc-js` override patches Firebase's Node-side dependency; it is covered by the emulator tests.
- Full development-tool audit: **26 moderate, 2 low, zero high/critical** upstream advisories in transitive CLI/lint/build tools on this date. These are not shipped in the browser bundle. Some automatic fixes propose downgrading maintained primary tools, so no forced downgrade was applied. Review future tool releases and monthly Dependabot updates.
- Local visual QA: 1440px desktop and 390px phone setup layouts rendered without horizontal overflow.
- Live Pages browser verification: `https://khumainishaik.github.io/hifz-tracker/#/hifz` loaded and refreshed successfully at a 390px viewport, with no JavaScript page errors or horizontal overflow.

Initial successful release evidence: [GitHub Actions run 42489524521](https://github.com/KhumainiShaik/hifz-tracker/actions/runs/42489524521). Subsequent pushes re-run the full gated workflow; the latest result is available in [Actions](https://github.com/KhumainiShaik/hifz-tracker/actions/workflows/deploy.yml).

## Scope of the live verification

The public frontend is deployed and reachable. It displays **Ready for secure setup** because a production Firebase web configuration and owner UID have not been supplied. No real Firebase project, Google provider, production security rules, or progress records were created or claimed verified. The secure setup flow intentionally grants no database access.

The local emulator and matching-browser downloads were too slow on this connection, so server-rule and complete browser tests were run on GitHub-hosted runners instead. Their passing results are recorded above. Local visual checks used an already-installed Chromium test browser. The CI browser suite uses its matching Playwright Chromium. A physical iPhone/Safari installation remains part of the manual acceptance checklist, not a claimed test result.

## Remaining production acceptance

Follow [SETUP.md](SETUP.md): create/configure Firebase Spark, enable Google, authorize the Pages domain, obtain Abdul's UID through safe sign-in, deploy matching generated Rules and indexes, add the six GitHub repository variables, rebuild, save a real range and revision, refresh, invite a second Google account, confirm read-only access and revocation, export a backup, and install on an iPhone.

No production data was fabricated. Test fixtures and screenshots are isolated to emulator test runs. No service-account credentials are required or committed.
