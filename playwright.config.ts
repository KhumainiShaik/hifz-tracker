import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:5174/hifz-tracker/",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174/hifz-tracker/",
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      VITE_FIREBASE_API_KEY: "fake-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-hifz-tracker.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "demo-hifz-tracker",
      VITE_FIREBASE_APP_ID: "1:123:web:demo",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
      VITE_OWNER_UID: "test-owner",
      VITE_USE_EMULATORS: "true",
    },
  },
});
