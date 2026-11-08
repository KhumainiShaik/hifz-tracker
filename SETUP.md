# Setup and deployment

This guide separates **automated source/build tasks** from **manual account and console tasks**. You do not need a paid backend, Cloud Functions, email provider, billing upgrade, or Firebase service-account key.

## 1. GitHub repository — manual if not already created

Sign in to GitHub as `khumainishaik`. Create `hifz-tracker`. GitHub Pages on GitHub Free requires a public repository. Publish application source and public config only; progress remains in Firestore behind Rules.

If the repository already exists, use it. Otherwise, from this directory:

```sh
git init -b main
git add .
git commit -m "Build secure Hifz tracking application"
gh repo create khumainishaik/hifz-tracker --public --source=. --remote=origin
git push -u origin main
```

If authentication fails, run `gh auth login`. Do not overwrite an unrelated repository. The project `.gitignore` excludes local environment files, service-account filenames, generated Rules, backups and build output.

## 2. Create Firebase — manual Console actions

1. Open https://console.firebase.google.com/ and create a project. Keep the **Spark** plan. Google Analytics is unnecessary; leave it off.
2. Project Overview → add a **Web app** (`</>`). Give it a descriptive name. Firebase Hosting is not needed.
3. Copy the **public** Firebase configuration values: `apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`.
4. Build → Authentication → Get started → Sign-in method → **Google** → Enable. Choose a project support email and save. Do not enable anonymous or email/password sign-in for this app.
5. Build → Firestore Database → Create database → **Standard edition**, **production mode**. Choose a region close to you; database location is difficult to change later. Do not choose permissive test rules.
6. Authentication → Settings → Authorized domains: add **`khumainishaik.github.io`** and **`localhost`** for development. Do not include a scheme, path, or trailing slash. If testing at `127.0.0.1`, add that separately or use `localhost`. Keep your project's default Firebase auth domain.

Your Firebase web API key identifies the project; it is public configuration. Firestore Rules enforce data access. Never put service-account JSON, Google OAuth client secrets, or passwords in Vite variables.

## 3. Local installation — automated commands

Install Node 24 LTS and Java 21+ first. Then:

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local` with the five public values. Leave `VITE_OWNER_UID` blank initially. Leave `VITE_USE_EMULATORS=false` for your real Firebase project.

```sh
npm run dev
```

Open http://localhost:5173/hifz-tracker/ (or the printed port). The initial source rules deny all owner-scoped access because no authoritative UID is configured.

## 4. Securely establish ownership — manual sign-in, automated Rules generation

1. Click **Continue with Google** and choose Abdul's intended Google account. Allow popups if prompted. Popup sign-in is used to avoid cross-site redirect-storage issues on GitHub Pages and iPhone Safari.
2. The setup screen displays the authenticated **Firebase UID** and **Copy my UID**. It grants no database access.
3. Copy that exact UID into `VITE_OWNER_UID` in `.env.local`. The UID, not an entered email, is the owner identity. Check it against Firebase Authentication → Users if unsure.
4. Stop/restart Vite after changing environment variables.
5. Generate the production Rules:

```sh
npm run rules:configure
```

This writes ignored `firestore.production.rules` with the configured UID. The generator refuses empty or invalid UIDs. It never edits the locked source template. Setting `VITE_OWNER_UID` in the browser **does not** change server permissions; Rules deployment is essential.

## 5. Deploy Firestore Rules and indexes — authenticated manual operation

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID --config firebase.production.json
```

Choose the Firebase account that owns the project. The CLI uses your interactive login; no service account is needed. Verify the published Rules in Firestore → Rules: `ownerUid()` must return Abdul's exact UID. Confirm only the expected owner-scoped collections are allowed.

**Do not deploy `firebase.json` to production**: its default template intentionally denies configured access. Always generate Rules then pass `--config firebase.production.json`. Keep test UID `test-owner` and project `demo-hifz-tracker` confined to emulators.

Re-run `rules:configure` and redeploy Rules after changing their source. Changing the Pages site never deploys Firestore Rules. If rules fail, keep the previous secure version; never switch to `allow read, write: if true`.

## 6. Configure GitHub Pages — manual repository settings

1. Repository → Settings → Pages → Build and deployment → Source → **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** → New repository variable. Add:

| Variable | Firebase value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Web app `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Web app `authDomain`, normally `PROJECT.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_APP_ID` | Web app `appId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Web app `messagingSenderId` |
| `VITE_OWNER_UID` | Exact owner UID, matching deployed Rules |

Do **not** set `VITE_USE_EMULATORS` in production. The code also gates emulators behind Vite development mode. No Firebase secrets belong in Actions.

3. Push to `main`, or Actions → Verify and deploy Hifz Journey → Run workflow. A push runs typecheck, lint, unit/UI tests, Rules tests, browser tests, build validation, then deployment. Failed validation blocks deployment.
4. Check the Pages job and visit https://khumainishaik.github.io/hifz-tracker/. Rebuilding is required after repository variable changes. Without values, the public site safely shows setup instructions.
5. Test refreshing `https://khumainishaik.github.io/hifz-tracker/#/hifz`. HashRouter keeps the server request at the valid project path.

## 7. Validate locally — automated tests

```sh
npm run typecheck
npm run lint
npm test
npm run test:rules
npx playwright install chromium
npm run test:e2e
npm run build
```

The emulators bind only to localhost. Java 21+ is required. First run downloads the Firestore emulator. Browser and Rules fixtures are deliberately isolated; no production credentials or data are used. The browser tests use a development server with fake public config and a demo project.

## 8. First genuine record — manual release verification

1. Sign in as Abdul on the deployed site. Verify no sample activity appears.
2. Click **Add memorization**. Select a range genuinely memorized, date, and confidence. Optionally enter a private note.
3. Save. Wait until the success toast says **synchronized** and the top bar reads **Up to date**. Offline changes remain pending; a pending label is not a server confirmation.
4. Refresh the page and reopen the app. Verify the same range and count remain. Inspect Firestore if needed.
5. Add an overlapping range and verify overall unique coverage is not counted twice.
6. Log a revision, select the complete saved range, choose category/recall, and save. Check Revision → history and due queue.
7. Set goals, intervals, time zone, and theme. Save and refresh.

## 9. First invitation and revocation — manual two-account verification

1. Settings → Manage viewers, or the desktop sidebar. Enter the viewer's **exact Google account email**. Spaces at the edges are trimmed; ASCII case is lowered. Dots, plus suffixes, and domains are not rewritten. Ask for the address displayed by their Google account if uncertain.
2. Grant access. Copy the invitation link and send it manually. This app sends no email. The same token-free link works for every viewer; the verified account determines access.
3. In a separate browser/profile, open the link and sign in as the invited account. Confirm progress loads and no edit controls appear.
4. Confirm the private note is absent; a direct Rules test also checks it cannot be fetched.
5. Try an uninvited Google account: access must be denied.
6. Revoke the invitation from the owner account. Confirm the viewer loses live access and cannot refresh data from the server. Offline/downloaded copies cannot be recalled.
7. Restore access if desired.

The invitation can be created before the viewer has ever signed into Firebase. Google Workspace emails work if they match the verified token. Quoted, non-ASCII, or slash-containing email forms are deliberately unsupported for safe Firestore document paths.

## 10. Backup and iPhone installation — manual

- Settings → Export backup. Store the JSON privately; it contains private notes. Repeat monthly and before imports/deletions.
- Test restoring in a separate Firebase project/emulator before relying on a backup. Import previews counts, skips duplicates and conflicts, then asks for confirmation. Existing records win. Settings restore is optional. Invitations are not included.
- On iPhone, open the Pages URL in **Safari**, sign in, then Share → **Add to Home Screen**. Installed web apps may maintain a separate sign-in context; sign in there as necessary.
- The app shell is cached after first successful load. Owner Firestore data is cached when IndexedDB is available. Keep the app open after offline edits until Firebase acknowledges them.
- When **A fresh version is ready** appears, save/close forms, wait for pending changes, then choose **Update**. Browser eviction can remove offline caches; it does not remove confirmed Firestore records.

## Troubleshooting

- **Setup screen:** required public config is missing; set all five variables and rebuild.
- **UID copy screen:** owner UID is blank. Configure it and deploy matching Rules.
- **Permission denied as owner:** compare signed-in UID, Vite owner UID, generated Rules UID, and Firebase project ID. Deploy the correct Rules; do not loosen them.
- **Viewer stuck loading/denied:** check exact email, email verification, Google provider, active invitation, and network. The current viewer query is a direct invitation-document read.
- **Popup blocked/closed:** allow popups for this site and retry by tapping the sign-in button. Use Safari itself if an embedded messaging browser blocks Google.
- **Unauthorized domain:** add the hostname (without `/hifz-tracker/`) to Firebase Auth and retry.
- **Pending changes:** reconnect, keep the app open, wait for confirmation. Firestore reports failed writes; the app displays the error and never calls them synchronized.
- **Stale app:** save forms and accept the update prompt. Closing all tabs can free an old service worker. Avoid clearing browser data before pending writes have synchronized.
- **Quota exceeded:** wait for quota reset, reduce reloads/viewer tabs, inspect Firebase usage. The app needs no paid upgrade for ordinary personal use; quota is not unlimited.
