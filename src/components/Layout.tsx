import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Home,
  Settings,
  Users,
  LogOut,
  WifiOff,
  RefreshCw,
  CloudCheck,
  Cloud,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Logo, Skeleton, Modal } from "./ui";
import { useAuth, useData, useOnline, useToast } from "../lib/hooks";
import { logOut } from "../lib/firebase";
const navigation = [
  { to: "/", label: "Today", icon: Home },
  { to: "/hifz", label: "My Hifz", icon: BookOpen },
  { to: "/revision", label: "Revision", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: ChartNoAxesCombined },
  { to: "/settings", label: "Settings", icon: Settings },
];
function UpdatePrompt() {
  const { pending } = useData();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        const check = () => {
          if (navigator.onLine) void registration.update();
        };
        window.addEventListener("focus", check);
      }
    },
  });
  return needRefresh ? (
    <div className="update-banner" role="status">
      <span>A fresh version is ready. Save your form before updating.</span>
      <button
        className="button small"
        disabled={pending}
        onClick={() => void updateServiceWorker(true)}
      >
        Update
      </button>
      <button
        className="icon-button"
        aria-label="Dismiss update for now"
        onClick={() => setNeedRefresh(false)}
      >
        ×
      </button>
    </div>
  ) : null;
}
export function Layout() {
  const { user, role } = useAuth();
  const { settings, loading, pending, cached, error } = useData();
  const online = useOnline();
  const toast = useToast();
  const location = useLocation();
  const [account, setAccount] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        settings.theme === "dark" ||
          (settings.theme === "system" && query.matches),
      );
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [settings.theme]);
  useEffect(() => {
    document.getElementById("main-content")?.focus();
  }, [location.pathname]);
  async function exit() {
    if (pending) {
      toast(
        "Wait for pending changes to synchronize before signing out.",
        true,
      );
      return;
    }
    try {
      await logOut();
    } catch {
      toast("Sign out could not finish. Please try again.", true);
    }
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Logo />
        <div className="sidebar-label">YOUR DAILY COMPANION</div>
        <nav aria-label="Main navigation">
          {navigation
            .filter((n) => role === "owner" || n.to !== "/settings")
            .map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}>
                <n.icon size={20} />
                {n.label}
              </NavLink>
            ))}
          {role === "owner" && (
            <NavLink to="/viewers">
              <Users size={20} />
              Manage viewers
            </NavLink>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="little-star">✧</span>
          <p>
            Let consistency
            <br />
            be your quiet strength.
          </p>
          <small>ONE AYAH AT A TIME</small>
        </div>
        <button className="account-button" onClick={() => setAccount(true)}>
          <span className="avatar">
            {role === "owner" ? "AK" : (user?.displayName?.slice(0, 1) ?? "V")}
          </span>
          <span>
            <strong>
              {role === "owner"
                ? "Abdul Khumaini"
                : (user?.displayName ?? "Invited viewer")}
            </strong>
            <small>
              {role === "owner" ? "Your personal journey" : "Read-only viewer"}
            </small>
          </span>
          <LogOut size={16} />
        </button>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="desktop-only breadcrumb">
            My journey <span>/</span>{" "}
            {navigation.find((n) => n.to === location.pathname)?.label ??
              "Manage viewers"}
          </div>
          <div className="mobile-only">
            <Logo />
          </div>
          <div className="topbar-actions">
            <span
              className={`sync-state ${!online || pending ? "sync-pending" : ""}`}
              aria-live="polite"
            >
              {!online ? (
                <WifiOff size={15} />
              ) : pending ? (
                <RefreshCw size={15} />
              ) : cached ? (
                <Cloud size={15} />
              ) : (
                <CloudCheck size={15} />
              )}
              <span>
                {!online
                  ? "Offline"
                  : pending
                    ? "Sync pending"
                    : cached
                      ? "Cached data"
                      : "Up to date"}
              </span>
            </span>
            {role === "viewer" && (
              <span className="pill viewer-pill">Read only</span>
            )}
            <button
              className="avatar small-avatar"
              aria-label="Account and sign out"
              onClick={() => setAccount(true)}
            >
              {role === "owner" ? "AK" : "V"}
            </button>
          </div>
        </header>
        <UpdatePrompt />
        {(!online || pending) && (
          <div className="connectivity" role="status">
            {!online
              ? "You’re offline. Available records are cached; changes are not synchronized until the server confirms them."
              : "Your changes are pending. Keep the app open for confirmation."}
          </div>
        )}
        {role === "viewer" && !online && (
          <div className="connectivity">
            Offline access cannot confirm a current invitation. Reconnect to
            refresh access.
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {error ? (
            <section className="card error-card">
              <h1>We couldn’t load your journey</h1>
              <p role="alert">{error}</p>
              <button
                className="button"
                onClick={() => location.pathname && window.location.reload()}
              >
                Try again
              </button>
            </section>
          ) : loading ? (
            <Skeleton />
          ) : (
            <Outlet />
          )}
          <footer className="app-footer">
            <span>Small steps. Lasting connection.</span>
            <span>
              Quran metadata by{" "}
              <a
                href="https://tanzil.net/docs/Quran_Metadata"
                target="_blank"
                rel="noreferrer"
              >
                Tanzil
              </a>{" "}
              · 6,236 ayahs
            </span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation
          .filter((n) => role === "owner" || n.to !== "/settings")
          .map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <n.icon size={21} />
              <span>{n.label}</span>
            </NavLink>
          ))}
      </nav>
      {account && (
        <Modal title="Your account" onClose={() => setAccount(false)}>
          <div className="account-details">
            <strong>{user?.displayName}</strong>
            <p>{user?.email}</p>
            <small>
              {role === "owner"
                ? "Owner · full access"
                : "Viewer · progress access only"}
            </small>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => void exit()}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
