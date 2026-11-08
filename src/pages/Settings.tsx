import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Users,
  LogOut,
  Save,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  useAuth,
  useData,
  useMutation,
  useToast,
  useOnline,
} from "../lib/hooks";
import { settingsSchema } from "../lib/models";
import { database, friendlyError, logOut, OWNER_UID } from "../lib/firebase";
import { applyImport, saveSettings, serverBackup } from "../lib/repository";
import { exportBackup, parseBackup, previewImport } from "../lib/backup";
import type { ImportPlan } from "../lib/backup";
import { Card, PageHeading, Field, Modal } from "../components/ui";
export function Settings() {
  const { user } = useAuth();
  const { settings, data, pending } = useData();
  const toast = useToast();
  const online = useOnline();
  const [draft, setDraft] = useState(settings),
    [intervalText, setIntervalText] = useState(settings.intervals.join(", ")),
    [error, setError] = useState(""),
    [plan, setPlan] = useState<ImportPlan | null>(null),
    [restoreSettings, setRestoreSettings] = useState(false),
    [importProgress, setImportProgress] = useState("");
  const { busy, run } = useMutation();
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const next = settingsSchema.parse({
        ...draft,
        intervals: intervalText.split(",").map((v) => Number(v.trim())),
      });
      setError("");
      void run(
        () =>
          saveSettings(database(true), OWNER_UID, next, !data.settings.length),
        "Preferences synchronized.",
      );
    } catch {
      setError(
        "Check your goals, time zone, and intervals. Use increasing whole-day intervals between 1 and 365, separated by commas.",
      );
    }
  }
  async function download() {
    await run(async () => {
      const snapshot = await serverBackup(database(true), OWNER_UID);
      const json = exportBackup(snapshot);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `khumaini-hifz-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "Backup downloaded from confirmed server data.");
  }
  async function prepare(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 15_000_000)
        throw new Error("Choose a backup under 15 MB.");
      const incoming = parseBackup(await file.text());
      const current = await serverBackup(database(true), OWNER_UID);
      setPlan(previewImport(current, incoming));
      setRestoreSettings(false);
      setImportProgress("");
    } catch (error) {
      toast(
        error instanceof Error && error.name === "ZodError"
          ? "This backup has invalid or unexpected fields. No data was imported."
          : friendlyError(error),
        true,
      );
    }
  }
  async function restore() {
    if (!plan) return;
    await run(
      async () => {
        const fresh = await serverBackup(database(true), OWNER_UID);
        const refreshed = previewImport(fresh, plan.data);
        if (!restoreSettings) {
          refreshed.data.settings = [];
          refreshed.data.profile = [];
        }
        await applyImport(database(true), OWNER_UID, refreshed, (done, total) =>
          setImportProgress(`${done} of ${total} sessions synchronized`),
        );
      },
      "Backup import completed.",
      () => setPlan(null),
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE THIS SPACE YOURS"
        title="Settings"
        description="A sustainable rhythm, thoughtful preferences, and a safe copy of your journey."
      />
      <form onSubmit={submit} className="settings-grid">
        <Card>
          <h2>Daily intentions</h2>
          <p className="muted compact">
            Set goals that fit your life. Small and consistent is a good place
            to start.
          </p>
          <div className="form-grid">
            <Field label="Daily memorization goal (ayahs)">
              <input
                type="number"
                required
                min={1}
                max={1000}
                value={draft.dailyGoal}
                onChange={(e) =>
                  setDraft({ ...draft, dailyGoal: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Daily revision goal (sessions)">
              <input
                type="number"
                required
                min={1}
                max={100}
                value={draft.revisionGoal}
                onChange={(e) =>
                  setDraft({ ...draft, revisionGoal: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field
            label="Preferred tracking unit"
            hint="Ayah goals and exact range entry stay available in either view."
          >
            <select
              value={draft.unit}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  unit: e.target.value as typeof draft.unit,
                })
              }
            >
              <option value="ayahs">Ayahs</option>
              <option value="juz">Juz coverage</option>
            </select>
          </Field>
          <Field
            label="Revision gaps (days)"
            hint="Strong advances, Okay repeats, Needs practice restarts. Changes recalculate automatic schedules."
          >
            <input
              required
              value={intervalText}
              onChange={(e) => setIntervalText(e.target.value)}
            />
          </Field>
        </Card>
        <Card>
          <h2>Your preferences</h2>
          <Field label="Appearance">
            <select
              value={draft.theme}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  theme: e.target.value as typeof draft.theme,
                })
              }
            >
              <option value="system">Follow device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <Field
            label="Time zone"
            hint="Dates and streaks use this zone. Existing session dates are preserved when you change it."
          >
            <input
              required
              list="time-zones"
              value={draft.timeZone}
              onChange={(e) => setDraft({ ...draft, timeZone: e.target.value })}
            />
            <datalist id="time-zones">
              {[
                "Asia/Kolkata",
                "Asia/Riyadh",
                "Asia/Dubai",
                "Europe/London",
                "America/New_York",
                "America/Los_Angeles",
                "UTC",
              ].map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </datalist>
          </Field>
          <Field
            label="Mushaf page references"
            hint="Only the 604-page Medina Mushaf mapping from Tanzil is supported."
          >
            <select
              value={draft.mushaf}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  mushaf: e.target.value as typeof draft.mushaf,
                })
              }
            >
              <option value="medina-604">Medina Mushaf · 604 pages</option>
              <option value="none">Hide page references</option>
            </select>
          </Field>
          <p className="privacy-note">
            <ShieldCheck size={16} />
            Preferences are owner-only. Goals, time zone, and revision gaps are
            shared in the progress profile.
          </p>
        </Card>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-save">
          <button className="button" disabled={busy}>
            <Save size={17} />
            {busy ? "Waiting for sync…" : "Save preferences"}
          </button>
        </div>
      </form>
      <div className="settings-grid">
        <Card>
          <h2>Keep your journey safe</h2>
          <p className="muted">
            Export a JSON backup monthly and before large changes. Keep a dated
            copy in a private drive you trust. Backups contain your private
            notes.
          </p>
          <div className="quick-actions">
            <button
              className="button secondary"
              disabled={busy || pending || !online}
              onClick={() => void download()}
            >
              <Download size={17} />
              Export backup
            </button>
            <label
              className={`button secondary file-button ${busy || pending || !online ? "disabled" : ""}`}
            >
              <Upload size={17} />
              Import backup
              <input
                aria-label="Import backup JSON"
                type="file"
                accept=".json,application/json"
                disabled={busy || pending || !online}
                onChange={(e) => void prepare(e)}
              />
            </label>
          </div>
          <p className="muted compact">
            Backup operations require a connection and no pending changes.
            Imports merge new sessions; they never delete existing progress or
            restore invitations.
          </p>
        </Card>
        <Card>
          <h2>Your account</h2>
          <div className="account-details">
            <strong>{user?.displayName}</strong>
            <span>{user?.email}</span>
            <small>Owner · full access</small>
            <code>{user?.uid}</code>
          </div>
          <div className="quick-actions">
            <Link className="button secondary" to="/viewers">
              <Users size={17} />
              Manage viewers
            </Link>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() =>
                void logOut().catch((e) => toast(friendlyError(e), true))
              }
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
          <p className="muted compact">
            On iPhone, open this site in Safari, tap Share, then Add to Home
            Screen. The app caches its shell for offline use.
          </p>
        </Card>
      </div>
      {plan && (
        <Modal
          title="Review your backup import"
          onClose={() => {
            if (!busy) setPlan(null);
          }}
        >
          <div className="form-stack">
            <p>
              <strong>{plan.added}</strong> new sessions ·{" "}
              <strong>{plan.skipped}</strong> existing sessions skipped ·{" "}
              <strong>{plan.conflicts}</strong> differences kept as-is.
            </p>
            <p className="muted">
              Current records win when an ID or exact session matches. Private
              notes are restored only with their new sessions. Access
              invitations are never imported.
            </p>
            {plan.settingsChanged && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={restoreSettings}
                  onChange={(e) => setRestoreSettings(e.target.checked)}
                />
                Also restore goals and preferences from this backup
              </label>
            )}
            <p className="callout">
              Keep other devices idle during import. Large imports use several
              atomic batches; if interrupted, repeat the import to safely skip
              completed sessions.
            </p>
            {importProgress && <p role="status">{importProgress}</p>}
            <div className="form-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setPlan(null)}
              >
                Cancel
              </button>
              <button
                className="button"
                disabled={busy || !online}
                onClick={() => void restore()}
              >
                {busy ? "Importing…" : "Confirm import"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
