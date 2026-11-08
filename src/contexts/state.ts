import { createContext } from "react";
import type { User } from "firebase/auth";
import { defaultSettings, emptyDataset } from "../lib/models";
import type { Dataset, Role, Settings } from "../lib/models";
export interface AuthState {
  user: User | null;
  role: Role;
  error: string;
}
export interface DataState {
  data: Dataset;
  settings: Settings;
  loading: boolean;
  pending: boolean;
  cached: boolean;
  error: string;
}
export const AuthContext = createContext<AuthState>({
  user: null,
  role: "loading",
  error: "",
});
export const DataContext = createContext<DataState>({
  data: emptyDataset(),
  settings: defaultSettings(),
  loading: true,
  pending: false,
  cached: false,
  error: "",
});
export const ToastContext = createContext<
  (message: string, error?: boolean) => void
>(() => {});
