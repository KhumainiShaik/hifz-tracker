import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Leaf,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { Logo } from "../components/ui";
import { useAuth, useToast } from "../lib/hooks";
import {
  firebaseConfigured,
  googleSignIn,
  logOut,
  friendlyError,
} from "../lib/firebase";
export function Welcome() {
  const { user, role, error } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true);
    try {
      await googleSignIn();
    } catch (error) {
      toast(friendlyError(error), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="welcome">
      <header>
        <Logo />
        <span className="pill">
          <ShieldCheck size={14} /> A private, personal journey
        </span>
      </header>
      <main className="welcome-grid">
        <div className="welcome-copy">
          <p className="eyebrow">BISMILLAH · BEGIN WITH INTENTION</p>
          <h1>
            One ayah.
            <br />
            One day.
            <br />
            <em>A lifelong journey.</em>
          </h1>
          <p className="welcome-description">
            A quiet space to nurture your memorization, return to what you’ve
            learned, and see how far you’ve come.
          </p>
          <div className="welcome-features">
            <span>
              <BookOpen />
              Mindful memorization
            </span>
            <span>
              <Sun />
              Consistent revision
            </span>
            <span>
              <Leaf />
              Meaningful progress
            </span>
          </div>
          <small>Abdul Khumaini Shaik’s Hifz Tracker</small>
        </div>
        <section className="welcome-panel">
          <div className="arch-art" aria-hidden="true">
            <div />
            <BookOpen size={54} strokeWidth={1} />
            <span>بِسْمِ اللَّهِ</span>
          </div>
          <div className="welcome-panel-content">
            <p className="eyebrow">YOUR JOURNEY, SAFELY KEPT</p>
            <h2>
              {role === "setup"
                ? "Set up your ownership"
                : role === "denied"
                  ? "An invitation is needed"
                  : "Assalamu alaikum"}
            </h2>
            {!firebaseConfigured ? (
              <>
                <p>
                  Connect your Firebase project to begin. Your journey starts
                  with your own records.
                </p>
                <div className="setup-box">
                  <strong>Ready for secure setup</strong>
                  <ol>
                    <li>Create a Firebase project on the Spark plan.</li>
                    <li>
                      Add the public web configuration to{" "}
                      <code>.env.local</code> or GitHub repository variables.
                    </li>
                    <li>Enable Google sign-in, then return here.</li>
                  </ol>
                  <p>
                    Follow{" "}
                    <a
                      href="https://github.com/khumainishaik/hifz-tracker/blob/main/SETUP.md"
                      target="_blank"
                      rel="noreferrer"
                    >
                      the setup guide <ArrowRight size={14} />
                    </a>{" "}
                    for the complete steps.
                  </p>
                </div>
                <span className="privacy-note">
                  <Check size={16} /> No account or progress data has been
                  created.
                </span>
              </>
            ) : role === "setup" ? (
              <>
                <p>
                  Signed in as {user?.email}. Copy your Firebase UID, set{" "}
                  <code>VITE_OWNER_UID</code>, and deploy rules generated for
                  the same UID. Rebuild the site to finish.
                </p>
                <code className="uid">{user?.uid}</code>
                <button
                  className="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(user?.uid ?? "").then(
                      () => toast("UID copied."),
                      () =>
                        toast(
                          "Clipboard unavailable. Select and copy the UID.",
                          true,
                        ),
                    );
                  }}
                >
                  <Copy size={16} /> Copy my UID
                </button>
                <p className="callout">
                  Database access stays locked until the owner is configured.
                  This sign-in does not grant ownership.
                </p>
                <button
                  className="button secondary"
                  onClick={() =>
                    void logOut().catch((error) =>
                      toast(friendlyError(error), true),
                    )
                  }
                >
                  Sign out
                </button>
              </>
            ) : role === "denied" ? (
              <>
                <p>{error}</p>
                <p>
                  Ask Abdul Khumaini to invite the exact address{" "}
                  <strong>{user?.email}</strong>. The shared link alone does not
                  grant access.
                </p>
                <button
                  className="button"
                  onClick={() =>
                    void logOut().catch((error) =>
                      toast(friendlyError(error), true),
                    )
                  }
                >
                  Use another Google account
                </button>
              </>
            ) : (
              <>
                <p>
                  Sign in to continue your Hifz journey, or follow Abdul Khumaini’s
                  progress with an invited Google account.
                </p>
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                <button
                  className="button google-button"
                  disabled={busy}
                  onClick={() => void login()}
                >
                  <span className="google-g" aria-hidden="true">
                    G
                  </span>
                  {busy ? "Opening Google…" : "Continue with Google"}
                  <ArrowRight size={18} />
                </button>
                <p className="sign-in-note">
                  Your account stays private. Only Abdul Khumaini can make changes;
                  invited family and teachers can follow along.
                </p>
              </>
            )}
          </div>
        </section>
      </main>
      <footer>
        Made for steady steps. Built around your intention.
        <span>MEMORIZE · REVISE · GROW</span>
      </footer>
    </div>
  );
}
