import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Copy, UserPlus, ShieldCheck, UserRoundX, Users } from "lucide-react";
import { database, OWNER_UID, friendlyError } from "../lib/firebase";
import { baseRecord, normalizeEmail } from "../lib/models";
import type { Invitation } from "../lib/models";
import { saveInvitation, watchCollection } from "../lib/repository";
import { useMutation, useToast, useOnline } from "../lib/hooks";
import { Card, PageHeading, Empty, Field, Confirm } from "../components/ui";
export function Viewers() {
  const [invitations, setInvitations] = useState<Invitation[]>([]),
    [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revoke, setRevoke] = useState<Invitation | null>(null);
  const { busy, run } = useMutation();
  const toast = useToast();
  const online = useOnline();
  useEffect(
    () =>
      watchCollection<Invitation>(
        database(true),
        OWNER_UID,
        "viewerInvitations",
        (rows) => {
          setInvitations(rows);
          setLoading(false);
        },
        (error) => {
          setError(friendlyError(error));
          setLoading(false);
        },
      ),
    [],
  );
  function invite(e: FormEvent) {
    e.preventDefault();
    try {
      const normalized = normalizeEmail(email);
      const existing = invitations.find((i) => i.email === normalized);
      setError("");
      void run(
        () =>
          saveInvitation(
            database(true),
            OWNER_UID,
            {
              ...(existing ?? baseRecord(normalized)),
              email: normalized,
              status: "active",
            },
            !existing,
          ),
        "Viewer access granted. Copy the link and send it yourself.",
        () => setEmail(""),
      );
    } catch (error) {
      setError(friendlyError(error));
    }
  }
  const link = `${window.location.origin}${import.meta.env.BASE_URL}#/invite`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast(
        "Invitation link copied. Send it to the invited Google account holder.",
      );
    } catch {
      toast(`Copy this link: ${link}`, true);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SHARE YOUR PROGRESS, KEEP YOUR PRIVACY"
        title="Manage viewers"
        description="Invite family or a teacher to follow your journey, with read-only access."
      />
      <div className="settings-grid">
        <Card>
          <h2>
            <UserPlus size={20} /> Invite a viewer
          </h2>
          <form onSubmit={invite} className="form-stack">
            <Field
              label="Google account email"
              hint="Use the exact email shown by their Google account. Dots and plus aliases are not merged."
            >
              <input
                type="email"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
              />
            </Field>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" disabled={busy || !online}>
              <UserPlus size={17} />
              Grant read-only access
            </button>
          </form>
          <div className="invite-instructions">
            <h3>Then send the invitation</h3>
            <p>
              Copy the link and share it yourself via WhatsApp, email, or a
              message. This app does not send emails.
            </p>
            <button className="button secondary" onClick={() => void copy()}>
              <Copy size={16} />
              Copy invitation link
            </button>
            <p>
              They must sign in with the exact verified Google email you
              invited. The link contains no access token and grants no access by
              itself.
            </p>
          </div>
        </Card>
        <Card className="permissions-card">
          <span className="activity-icon">
            <ShieldCheck size={23} />
          </span>
          <h2>A window into your progress</h2>
          <p>
            Viewers can see memorized ranges, revisions, streaks, goals, and
            your progress calendar.
          </p>
          <ul>
            <li>You remain the only person who can change records.</li>
            <li>Your private notes and settings stay private.</li>
            <li>Viewers cannot see other invitations.</li>
            <li>You can revoke access at any time.</li>
          </ul>
          <p className="callout">
            Revocation blocks subsequent server-authorized reads. It cannot
            erase records already downloaded, copied, exported, cached, or
            screenshotted.
          </p>
        </Card>
      </div>
      <Card>
        <div className="section-heading">
          <h2>
            <Users size={20} /> Your viewers
          </h2>
          <span className="pill">
            {invitations.filter((i) => i.status === "active").length} active
          </span>
        </div>
        {loading ? (
          <p role="status">Loading invitations…</p>
        ) : invitations.length ? (
          <div>
            {[...invitations]
              .sort(
                (a, b) =>
                  a.status.localeCompare(b.status) ||
                  a.email.localeCompare(b.email),
              )
              .map((i) => (
                <div className="record-row viewer-row" key={i.id}>
                  <span className="avatar">{i.email[0].toUpperCase()}</span>
                  <div>
                    <strong>{i.email}</strong>
                    <small>Google account · read-only</small>
                  </div>
                  <span
                    className={`pill ${i.status === "revoked" ? "neutral" : ""}`}
                  >
                    {i.status}
                  </span>
                  {i.status === "active" ? (
                    <>
                      <button
                        className="icon-button"
                        aria-label={`Copy invitation link for ${i.email}`}
                        onClick={() => void copy()}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="button secondary small"
                        disabled={!online}
                        onClick={() => setRevoke(i)}
                      >
                        <UserRoundX size={15} />
                        Revoke
                      </button>
                    </>
                  ) : (
                    <button
                      className="button secondary small"
                      disabled={busy || !online}
                      onClick={() =>
                        void run(
                          () =>
                            saveInvitation(
                              database(true),
                              OWNER_UID,
                              { ...i, status: "active" },
                              false,
                            ),
                          "Viewer access restored.",
                        )
                      }
                    >
                      Restore access
                    </button>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <Empty title="Let someone walk alongside you">
            Invite a family member or teacher when you’re ready to share your
            progress.
          </Empty>
        )}
      </Card>
      {revoke && (
        <Confirm
          title="Revoke viewer access?"
          busy={busy}
          onClose={() => setRevoke(null)}
          onConfirm={() =>
            void run(
              () =>
                saveInvitation(
                  database(true),
                  OWNER_UID,
                  { ...revoke, status: "revoked" },
                  false,
                ),
              "Viewer access revoked.",
              () => setRevoke(null),
            )
          }
        >
          {revoke.email} will be denied future server-authorized reads.
          Previously downloaded information cannot be recalled.
        </Confirm>
      )}
    </>
  );
}
