import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, Timestamp } from "firebase/firestore";
const project = "demo-hifz-tracker";
async function login(page: Page, email: string) {
  await page.goto("./");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.getByText(email, { exact: false }).click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}
test.beforeEach(async () => {
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8").replace(
        "return '__OWNER_UID_NOT_CONFIGURED__';",
        "return 'test-owner';",
      ),
    },
  });
  await env.clearFirestore();
  const baseUrl = `http://127.0.0.1:9099`;
  await fetch(`${baseUrl}/emulator/v1/projects/${project}/accounts`, {
    method: "DELETE",
  });
  const users = [
    {
      localId: "test-owner",
      email: "abdul@example.com",
      displayName: "Abdul Khumaini Shaik",
    },
    {
      localId: "test-viewer",
      email: "teacher@example.com",
      displayName: "Teacher",
    },
    {
      localId: "test-stranger",
      email: "stranger@example.com",
      displayName: "Uninvited User",
    },
  ].map((u) => ({
    ...u,
    emailVerified: true,
    providerUserInfo: [
      {
        providerId: "google.com",
        rawId: u.email,
        email: u.email,
        displayName: u.displayName,
      },
    ],
  }));
  const response = await fetch(
    `${baseUrl}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchCreate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({ users }),
    },
  );
  if (!response.ok)
    throw new Error(`Auth emulator seed failed: ${await response.text()}`);
  await env.cleanup();
});
test("owner journey, persistence, backup, invitation and read-only revocation", async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "abdul@example.com");
  await expect(
    page.getByRole("heading", { name: "Assalamu alaikum, Abdul." }),
  ).toBeVisible();
  await expect(page.getByText("Your story starts here")).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-empty-today.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Add memorization", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Private notes (optional)")
    .fill("Private browser-test note");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Memorization synchronized.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Assalamu alaikum, Abdul." }),
  ).toBeVisible();
  await expect(page.getByText("7 of 6,236 ayahs")).toBeVisible();
  // Exercise actual SDK offline queuing: no server-confirmed success before reconnect.
  await page
    .getByRole("button", { name: "Add memorization", exact: true })
    .first()
    .click();
  await page.getByLabel("Surah", { exact: true }).selectOption("112");
  await page.getByLabel("Ending ayah").fill("4");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Waiting for sync…" }),
  ).toBeVisible();
  await expect(page.getByText("Memorization synchronized.")).toHaveCount(0);
  await page.context().setOffline(false);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.getByText("11 of 6,236 ayahs")).toBeVisible();

  await page.getByRole("button", { name: "Log revision", exact: true }).click();
  await page
    .getByLabel("Review a memorized range")
    .selectOption({ label: "Al-Faatiha · 1–7" });
  await page.getByLabel("Recall quality").selectOption("strong");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("./#/settings");
  await page.getByLabel("Daily memorization goal (ayahs)").fill("8");
  await page.getByLabel("Appearance").selectOption("dark");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-settings-dark.png`,
    fullPage: true,
  });
  await page.getByLabel("Appearance").selectOption("light");
  await page.getByRole("button", { name: "Save preferences" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.getByLabel("Import backup JSON").setInputFiles(path!);
  await expect(
    page.getByRole("dialog", { name: "Review your backup import" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("./#/hifz");
  await page.getByRole("button", { name: /Al-Faatiha/ }).click();
  await expect(
    page.getByText("Private: Private browser-test note"),
  ).toBeVisible();
  await page.goto("./#/insights");
  await expect(
    page.getByRole("heading", { name: "A journey in perspective" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-insights.png`,
    fullPage: true,
  });
  await page.goto("./#/viewers");
  await page.getByLabel("Google account email").fill("teacher@example.com");
  await page.getByRole("button", { name: "Grant read-only access" }).click();
  await expect(page.getByText("1 active")).toBeVisible();
  const viewerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const viewer = await viewerContext.newPage();
  await viewer.goto("http://127.0.0.1:5174/hifz-tracker/");
  const popupPromise = viewer.waitForEvent("popup");
  await viewer.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.getByText("teacher@example.com", { exact: false }).click();
  await expect(
    viewer.getByRole("heading", { name: "A window into Abdul’s journey." }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: /add memorization|log revision/i }),
  ).toHaveCount(0);
  await viewer.goto("http://127.0.0.1:5174/hifz-tracker/#/hifz");
  await viewer.getByRole("button", { name: /Al-Faatiha/ }).click();
  await expect(viewer.getByText(/Private browser-test note/)).toHaveCount(0);
  await expect(
    viewer.getByRole("button", { name: /edit|delete/i }),
  ).toHaveCount(0);
  await viewer.goto("http://127.0.0.1:5174/hifz-tracker/#/settings");
  await expect(
    viewer.getByRole("heading", { name: "A window into Abdul’s journey." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revoke", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Viewer access revoked.")).toBeVisible();
  await expect(
    viewer.getByRole("heading", { name: "An invitation is needed" }),
  ).toBeVisible();
  await viewerContext.close();
  expect(errors).toEqual([]);
});
test("uninvited account sees no progress even with the invitation URL", async ({
  page,
}) => {
  await login(page, "stranger@example.com");
  await expect(
    page.getByRole("heading", { name: "An invitation is needed" }),
  ).toBeVisible();
  await page.goto("./#/invite");
  await expect(
    page.getByText("This Google account does not have an active invitation."),
  ).toBeVisible();
});
test("range validation, edits and confirmed deletion persist", async ({
  page,
}) => {
  const env = await initializeTestEnvironment({
    projectId: project,
    firestore: { host: "127.0.0.1", port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = {
      schemaVersion: 1,
      createdAt: Timestamp.fromMillis(1700000000000),
      updatedAt: Timestamp.fromMillis(1700000000000),
      surah: 1,
      start: 1,
      end: 7,
      date: "2026-01-01",
      confidence: "okay",
    };
    await setDoc(
      doc(ctx.firestore(), "owners/test-owner/memorizedRanges/m1"),
      d,
    );
    await setDoc(
      doc(ctx.firestore(), "owners/test-owner/memorizationSessions/m1"),
      d,
    );
  });
  await env.cleanup();
  await login(page, "abdul@example.com");
  await page.goto("./#/hifz");
  await page.getByRole("button", { name: /Al-Faatiha/ }).click();
  await page
    .getByRole("button", { name: "Edit Al-Faatiha ayahs 1 to 7" })
    .click();
  await page.getByLabel("Ending ayah").fill("8");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Ending ayah").fill("6");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Al-Faatiha/ }).click();
  await expect(page.getByText("Ayahs 1–6", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Al-Faatiha ayahs 1 to 6" })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Range deleted.")).toBeVisible();
  await expect(
    page.getByText("No memorized ranges recorded for this Surah yet."),
  ).toBeVisible();
});
