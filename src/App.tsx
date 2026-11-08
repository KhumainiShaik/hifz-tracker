import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import { ToastProvider } from "./contexts/ToastContext";
import { useAuth } from "./lib/hooks";
import { Layout } from "./components/Layout";
import { Skeleton } from "./components/ui";
import { Welcome } from "./pages/Welcome";
import { Today } from "./pages/Today";
import { Hifz } from "./pages/Hifz";
import { Revision } from "./pages/Revision";
import { Insights } from "./pages/Insights";
import { Settings } from "./pages/Settings";
import { Viewers } from "./pages/Viewers";
export function OwnerOnly({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  return role === "owner" ? children : <Navigate to="/" replace />;
}
export function AppGate() {
  const { role, user } = useAuth();
  if (role === "loading")
    return (
      <div className="initial-loading">
        <Skeleton />
      </div>
    );
  if (role !== "owner" && role !== "viewer") return <Welcome />;
  return (
    <DataProvider key={`${user?.uid}-${role}`}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="hifz" element={<Hifz />} />
          <Route path="revision" element={<Revision />} />
          <Route path="insights" element={<Insights />} />
          <Route
            path="settings"
            element={
              <OwnerOnly>
                <Settings />
              </OwnerOnly>
            }
          />
          <Route
            path="viewers"
            element={
              <OwnerOnly>
                <Viewers />
              </OwnerOnly>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    void _info;
    console.error("Application error:", error.name);
  }
  render() {
    return this.state.failed ? (
      <main className="error-card">
        <h1>Let’s find our place again.</h1>
        <p>
          The app couldn’t finish loading. Your synchronized progress is still
          in Firestore.
        </p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload app
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <AppGate />
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
