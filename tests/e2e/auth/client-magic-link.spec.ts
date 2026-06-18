import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe("Client magic link flow", () => {
  test("expired magic link shows resend form at /auth/error", async ({
    page,
  }) => {
    await page.goto("/auth/error?error_code=otp_expired");

    await expect(page.getByLabelText(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /request new link/i })
    ).toBeVisible();
  });

  test("submitting resend form shows success message", async ({ page }) => {
    await page.goto("/auth/error?error_code=otp_expired");

    await page.fill('[name="email"]', "test@client.com");
    await page.click('button:has-text("Request new link")');

    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test.skip("valid magic link creates session and redirects to /track", async ({
    page,
  }) => {
    // Requires Supabase local running + admin API to generate link
    // Skip in CI unless TEST_SUPABASE_RUNNING=true
    if (!process.env.TEST_SUPABASE_RUNNING) return;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testEmail = `e2e-${Date.now()}@client.test`;

    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: testEmail,
      options: { redirectTo: "http://localhost:3000/track" },
    });

    if (!linkData?.properties?.action_link) {
      throw new Error("Failed to generate magic link");
    }

    await page.goto(linkData.properties.action_link);
    await expect(page).toHaveURL(/\/track/);
  });
});
