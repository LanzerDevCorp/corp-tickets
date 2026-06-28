import { defineConfig, devices } from "@playwright/test";

/**
 * Load env files into the Playwright runner process. Next.js loads them for the
 * app, but the test runner and global setup also need NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY (e.g. to seed the e2e admin via the service
 * role). Loaded in Next's precedence order; later files override earlier ones.
 */
for (const envFile of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // File may be absent (or vars exported directly in CI) — ignore.
  }
}

/**
 * Corp Tickets — Playwright end-to-end test configuration.
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: "html",
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Slow each action down to watch the run live: `SLOWMO=800 ... --headed`. */
    launchOptions: {
      slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : undefined,
    },
  },
  /* Configure projects for major browsers */
  projects: [
    /* Seeds the e2e admin and persists its session before the browser projects run. */
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
    },
  ],
  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined),
    ) as Record<string, string>,
  },
});
