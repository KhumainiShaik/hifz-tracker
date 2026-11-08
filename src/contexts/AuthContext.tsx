import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, database, friendlyError, OWNER_UID } from "../lib/firebase";
import { invitationKey } from "../lib/models";
import { AuthContext } from "./state";
import type { AuthState } from "./state";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: auth ? "loading" : "signed-out",
    error: "",
  });
  useEffect(() => {
    if (!auth) return;
    let stopInvite: undefined | (() => void);
    let generation = 0;
    const stop = onIdTokenChanged(
      auth,
      async (user) => {
        const current = ++generation;
        stopInvite?.();
        stopInvite = undefined;
        // A routine token refresh must not unmount forms or resubscribe the whole history.
        setState((previous) =>
          user && previous.user?.uid === user.uid
            ? { ...previous, user, error: "" }
            : { user, role: user ? "loading" : "signed-out", error: "" },
        );
        if (!user) return;
        try {
          const token = await user.getIdTokenResult();
          if (current !== generation) return;
          const google =
            token.signInProvider === "google.com" &&
            token.claims.email_verified === true &&
            typeof token.claims.email === "string";
          if (!google) {
            setState({
              user,
              role: "denied",
              error: "Please sign in with a verified Google account.",
            });
            return;
          }
          if (!OWNER_UID) {
            setState({ user, role: "setup", error: "" });
            return;
          }
          if (user.uid === OWNER_UID) {
            database(true);
            setState({ user, role: "owner", error: "" });
            return;
          }
          const key = invitationKey(token.claims.email as string);
          stopInvite = onSnapshot(
            doc(
              database(false),
              `owners/${OWNER_UID}/viewerInvitations/${key}`,
            ),
            (snapshot) => {
              if (current !== generation) return;
              const active =
                snapshot.exists() && snapshot.data().status === "active";
              setState({
                user,
                role: active ? "viewer" : "denied",
                error: active
                  ? ""
                  : "This Google account does not have an active invitation.",
              });
            },
            (error) => {
              if (current === generation)
                setState({ user, role: "denied", error: friendlyError(error) });
            },
          );
        } catch (error) {
          if (current === generation)
            setState({ user, role: "denied", error: friendlyError(error) });
        }
      },
      (error) =>
        setState({
          user: null,
          role: "signed-out",
          error: friendlyError(error),
        }),
    );
    return () => {
      generation++;
      stop();
      stopInvite?.();
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
