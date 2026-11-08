import { useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext, DataContext } from "./state";
import { database, friendlyError, OWNER_UID } from "../lib/firebase";
import {
  defaultSettings,
  emptyDataset,
  collectionSchemas,
} from "../lib/models";
import type { Dataset } from "../lib/models";
import { watchCollection } from "../lib/repository";
export function DataProvider({ children }: { children: ReactNode }) {
  const { role, user } = useContext(AuthContext);
  const [state, setState] = useState({
    data: emptyDataset(),
    loading: true,
    pending: false,
    cached: false,
    error: "",
  });
  useEffect(() => {
    let active = true;
    const data = emptyDataset();
    const flags = new Map<string, { pending: boolean; cached: boolean }>();
    const names: (keyof Dataset)[] = [
      "memorizedRanges",
      "memorizationSessions",
      "revisionSessions",
      "revisionSchedules",
      "profile",
    ];
    if (role === "owner") names.push("settings", "privateNotes");
    let failed = false;
    const stops = names.map((name) =>
      watchCollection(
        database(role === "owner"),
        OWNER_UID,
        name,
        (rows, pending, cached) => {
          if (!active || failed) return;
          const checked = collectionSchemas[name].array().safeParse(rows);
          if (!checked.success) {
            failed = true;
            setState({
              data: emptyDataset(),
              loading: false,
              pending: false,
              cached: false,
              error:
                "A stored record has an unsupported schema or invalid values. Update the app or restore a validated backup.",
            });
            return;
          }
          Object.assign(data, { [name]: checked.data });
          flags.set(name, { pending, cached });
          setState({
            data: { ...data },
            loading: flags.size < names.length,
            pending: [...flags.values()].some((f) => f.pending),
            cached: [...flags.values()].some((f) => f.cached),
            error: "",
          });
        },
        (error) => {
          if (active) {
            failed = true;
            setState({
              data: emptyDataset(),
              loading: false,
              pending: false,
              cached: false,
              error: friendlyError(error),
            });
          }
        },
      ),
    );
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, [role, user?.uid]);
  const settings = { ...defaultSettings(), ...state.data.settings[0] };
  if (role === "viewer" && state.data.profile[0]) {
    const p = state.data.profile[0];
    Object.assign(settings, {
      timeZone: p.timeZone,
      intervals: p.intervals,
      dailyGoal: p.dailyGoal,
      revisionGoal: p.revisionGoal,
    });
  }
  return (
    <DataContext.Provider value={{ ...state, settings }}>
      {children}
    </DataContext.Provider>
  );
}
