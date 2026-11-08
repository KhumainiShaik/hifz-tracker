import { z } from "zod";
import { validRange } from "./quran";
import { validDate, validZone } from "./dates";
export const dateSchema = z
  .string()
  .refine(validDate, "Choose a valid calendar date.");
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const base = {
  id: idSchema,
  schemaVersion: z.literal(1),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
};
const range = {
  surah: z.number().int().min(1).max(114),
  start: z.number().int().min(1),
  end: z.number().int().min(1),
};
export const memorySchema = z
  .object({
    ...base,
    ...range,
    date: dateSchema,
    confidence: z.enum(["strong", "okay", "needs-practice"]),
  })
  .strict()
  .refine(
    validRange,
    "Ayahs must be within the selected Surah, with the end after the start.",
  );
export const revisionSchema = z
  .object({
    ...base,
    ...range,
    date: dateSchema,
    category: z.enum(["sabaq", "sabqi", "manzil"]),
    quality: z.enum(["strong", "okay", "needs-practice"]),
    memoryId: z.union([idSchema, z.literal("")]),
    nextReview: z.union([dateSchema, z.literal("")]),
  })
  .strict()
  .refine(validRange, "Choose a valid ayah range.")
  .refine(
    (r) => !r.nextReview || r.nextReview > r.date,
    "Next review must follow the revision date.",
  );
export const scheduleSchema = z
  .object({
    ...base,
    memoryId: idSchema,
    paused: z.boolean(),
    overrideDate: z.union([dateSchema, z.literal("")]),
  })
  .strict()
  .refine((s) => s.id === s.memoryId, "Schedule must use its memorization ID.");
export const noteSchema = z
  .object({ ...base, text: z.string().max(4000) })
  .strict();
export const settingsSchema = z
  .object({
    ...base,
    dailyGoal: z.number().int().min(1).max(1000),
    revisionGoal: z.number().int().min(1).max(100),
    unit: z.enum(["ayahs", "juz"]),
    mushaf: z.enum(["medina-604", "none"]),
    theme: z.enum(["light", "dark", "system"]),
    timeZone: z
      .string()
      .max(100)
      .refine(validZone, "Choose a valid IANA time zone."),
    intervals: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(10)
      .refine(
        (v) => v.every((n, i) => i === 0 || n > v[i - 1]),
        "Intervals must be increasing whole days, from 1 to 365.",
      ),
  })
  .strict();
export const profileSchema = z
  .object({
    ...base,
    displayName: z.literal("Abdul Khumaini Shaik"),
    timeZone: z.string().max(100).refine(validZone),
    dailyGoal: z.number().int().min(1).max(1000),
    revisionGoal: z.number().int().min(1).max(100),
    intervals: z.array(z.number().int().min(1).max(365)).min(1).max(10),
  })
  .strict();
export const invitationSchema = z
  .object({
    ...base,
    id: z.string().email().max(254),
    email: z.string().email().max(254),
    status: z.enum(["active", "revoked"]),
  })
  .strict();
export type Memory = z.infer<typeof memorySchema>;
export type Revision = z.infer<typeof revisionSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type Role =
  | "owner"
  | "viewer"
  | "setup"
  | "denied"
  | "signed-out"
  | "loading";
export const baseRecord = (id: string) => ({
  id,
  schemaVersion: 1 as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
export const defaultSettings = (): Settings => ({
  ...baseRecord("preferences"),
  dailyGoal: 5,
  revisionGoal: 2,
  unit: "ayahs",
  mushaf: "medina-604",
  theme: "system",
  timeZone: "Asia/Kolkata",
  intervals: [1, 3, 7, 14, 30],
});
export interface Dataset {
  memorizedRanges: Memory[];
  memorizationSessions: Memory[];
  revisionSessions: Revision[];
  revisionSchedules: Schedule[];
  privateNotes: Note[];
  settings: Settings[];
  profile: Profile[];
}
export const emptyDataset = (): Dataset => ({
  memorizedRanges: [],
  memorizationSessions: [],
  revisionSessions: [],
  revisionSchedules: [],
  privateNotes: [],
  settings: [],
  profile: [],
});
export const collectionSchemas = {
  memorizedRanges: memorySchema,
  memorizationSessions: memorySchema,
  revisionSessions: revisionSchema,
  revisionSchedules: scheduleSchema,
  privateNotes: noteSchema,
  settings: settingsSchema,
  profile: profileSchema,
};
// Do not fold dots, plus suffixes, or Gmail domains: use the actual Google token email.
export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (
    !/^[a-z0-9.!#$%&'*+?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(
      normalized,
    ) ||
    normalized.length > 254
  )
    throw new Error(
      "Enter the exact Google account email (standard ASCII address, no slashes).",
    );
  return normalized;
}
export const invitationKey = (email: string) => normalizeEmail(email);
export function sessionKey(
  kind: "m" | "r",
  r: {
    surah: number;
    start: number;
    end: number;
    date: string;
    category?: string;
  },
): string {
  return `${kind}_${r.date}_${r.surah}_${r.start}_${r.end}${kind === "r" ? `_${r.category}` : ""}`;
}

export const qualityLabel = (q: string) =>
  q === "needs-practice"
    ? "Needs practice"
    : q === "strong"
      ? "Strong"
      : "Okay";
