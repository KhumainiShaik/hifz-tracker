import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "firebase/auth";
import { AuthProvider } from "../../src/contexts/AuthContext";
import { AuthContext } from "../../src/contexts/state";
import { DataContext } from "../../src/contexts/state";
import { Today } from "../../src/pages/Today";
import { Hifz } from "../../src/pages/Hifz";
import { Welcome } from "../../src/pages/Welcome";
import { defaultSettings } from "../../src/lib/models";
import type { Role } from "../../src/lib/models";
import { useAuth } from "../../src/lib/hooks";
import { dataset } from "../fixtures";
const mocks = vi.hoisted(() => ({
  authListener: null as null | ((user: unknown) => void),
  inviteListener: null as null | ((snapshot: unknown) => void),
  unsubscribe: vi.fn(),
  login: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  onIdTokenChanged: vi.fn((_auth, fn) => {
    mocks.authListener = fn;
    return mocks.unsubscribe;
  }),
}));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, fn) => {
    mocks.inviteListener = fn;
    return mocks.unsubscribe;
  }),
}));
vi.mock("../../src/lib/firebase", () => ({
  auth: {},
  OWNER_UID: "test-owner",
  firebaseConfigured: true,
  database: vi.fn(() => ({})),
  googleSignIn: mocks.login,
  logOut: vi.fn(),
  friendlyError: (error: Error) => error.message,
}));
function Probe() {
  const state = useAuth();
  return <div>{state.role}</div>;
}
function fakeUser(
  uid = "test-owner",
  provider = "google.com",
  verified = true,
) {
  return {
    uid,
    email: "teacher@example.com",
    displayName: "Test User",
    getIdTokenResult: vi.fn().mockResolvedValue({
      signInProvider: provider,
      claims: { email: "teacher@example.com", email_verified: verified },
    }),
  } as unknown as User;
}
function context(role: Role, children: React.ReactNode) {
  return (
    <MemoryRouter>
      <AuthContext.Provider value={{ role, user: fakeUser(), error: "" }}>
        <DataContext.Provider
          value={{
            data: dataset(),
            settings: defaultSettings(),
            loading: false,
            pending: false,
            cached: false,
            error: "",
          }}
        >
          {children}
        </DataContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  mocks.authListener = null;
  mocks.inviteListener = null;
  vi.clearAllMocks();
});
describe("authentication state", () => {
  it("waits for auth and then handles sign-out", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
    await act(async () => {
      mocks.authListener!(null);
    });
    expect(screen.getByText("signed-out")).toBeInTheDocument();
  });
  it("grants ownership only to the configured Google UID", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      mocks.authListener!(fakeUser());
    });
    await waitFor(() => expect(screen.getByText("owner")).toBeInTheDocument());
  });
  it("keeps the authenticated screen mounted while the same user's token refreshes", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      mocks.authListener!(fakeUser());
    });
    expect(screen.getByText("owner")).toBeInTheDocument();
    const refreshed = fakeUser();
    let finish: (value: unknown) => void = () => {};
    vi.mocked(refreshed.getIdTokenResult).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve as (value: unknown) => void;
        }),
    );
    await act(async () => {
      mocks.authListener!(refreshed);
    });
    expect(screen.getByText("owner")).toBeInTheDocument();
    await act(async () => {
      finish({
        signInProvider: "google.com",
        claims: { email: "teacher@example.com", email_verified: true },
      });
    });
  });
  it("checks an invitation for other UIDs and reacts to revocation", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      mocks.authListener!(fakeUser("viewer"));
    });
    await act(async () => {
      mocks.inviteListener!({
        exists: () => true,
        data: () => ({ status: "active" }),
      });
    });
    expect(screen.getByText("viewer")).toBeInTheDocument();
    await act(async () => {
      mocks.inviteListener!({
        exists: () => true,
        data: () => ({ status: "revoked" }),
      });
    });
    expect(screen.getByText("denied")).toBeInTheDocument();
  });
  it("rejects unverified accounts before any invitation lookup", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      mocks.authListener!(fakeUser("viewer", "google.com", false));
    });
    expect(screen.getByText("denied")).toBeInTheDocument();
    expect(mocks.inviteListener).toBeNull();
  });
  it("shows safe UID onboarding without write controls", () => {
    render(context("setup", <Welcome />));
    expect(screen.getByText("test-owner")).toBeInTheDocument();
    expect(
      screen.getByText(/Database access stays locked/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save/i }),
    ).not.toBeInTheDocument();
  });
  it("reports Google popup failures", async () => {
    mocks.login.mockRejectedValueOnce(new Error("Popup blocked"));
    render(context("signed-out", <Welcome />));
    await userEvent.click(
      screen.getByRole("button", { name: /continue with Google/i }),
    );
    expect(mocks.login).toHaveBeenCalledOnce();
  });
});
describe("owner and viewer interfaces", () => {
  it("owner sees session actions; viewer gets a read-only dashboard", () => {
    const rendered = render(context("owner", <Today />));
    expect(
      screen.getAllByRole("button", { name: /add memorization/i }).length,
    ).toBeGreaterThan(0);
    rendered.unmount();
    render(context("viewer", <Today />));
    expect(
      screen.queryByRole("button", { name: /add memorization|log revision/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Invited viewer · read only")).toBeInTheDocument();
  });
  it("viewer never renders editing or private notes in expanded Surahs", async () => {
    render(context("viewer", <Hifz />));
    await userEvent.click(screen.getByRole("button", { name: /Al-Faatiha/ }));
    expect(
      screen.queryByRole("button", { name: /edit|delete/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Isolated test note/)).not.toBeInTheDocument();
  });
  it("owner can open the edit form with its private note", async () => {
    render(context("owner", <Hifz />));
    await userEvent.click(screen.getByRole("button", { name: /Al-Faatiha/ }));
    await userEvent.click(
      screen.getByRole("button", { name: /Edit Al-Faatiha/ }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Private notes/)).toHaveValue(
      "Isolated test note, never production data.",
    );
  });
});
