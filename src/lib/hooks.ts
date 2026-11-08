import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/state";
import { DataContext } from "../contexts/state";
import { ToastContext } from "../contexts/state";
import { dateInZone } from "./dates";
import { friendlyError } from "./firebase";
export const useAuth = () => useContext(AuthContext);
export const useData = () => useContext(DataContext);
export const useToast = () => useContext(ToastContext);
export function useToday(zone: string) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return dateInZone(now, zone);
}
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
export function useMutation() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return {
    busy,
    run: async (
      action: () => Promise<void>,
      message: string,
      done?: () => void,
    ) => {
      setBusy(true);
      if (!navigator.onLine)
        toast(
          "Saved changes will wait for a connection. Keep this device until synchronization completes.",
        );
      try {
        await action();
        toast(message);
        done?.();
      } catch (error) {
        toast(friendlyError(error), true);
      } finally {
        setBusy(false);
      }
    },
  };
}
