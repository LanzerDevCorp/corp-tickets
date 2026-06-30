import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe("Client magic link flow", () => {
  test("expired magic link redirects to /track/access with resend option", async ({
    page,
  }) => {
    // /auth/error now redirects to /track/access for otp_expired
    await page.goto("/track/access?error_code=otp_expired");

    // CardTitle renders as <div>, not a heading — use getByText
    await expect(page.getByText("Enlace expirado")).toBeVisible();

    // Expand the resend section
    await page
      .getByRole("button", { name: /prefieres un enlace por correo/i })
      .click();

    await expect(
      page.getByRole("button", { name: /solicitar nuevo enlace/i }),
    ).toBeVisible();
  });

  test("submitting resend form shows success message", async ({ page }) => {
    await page.goto("/track/access?error_code=otp_expired");

    // Expand the resend section
    await page
      .getByRole("button", { name: /prefieres un enlace por correo/i })
      .click();

    // The resend form has its own email input (last one on the page)
    await page
      .getByLabel(/correo electrónico/i)
      .last()
      .fill("test@client.com");
    await page.getByRole("button", { name: /solicitar nuevo enlace/i }).click();

    await expect(page.getByText(/revisa tu correo/i)).toBeVisible();
  });

  test("valid magic link creates session and redirects to /track", async ({
    page,
  }) => {
    if (!process.env.TEST_SUPABASE_RUNNING) {
      test.skip();
      return;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testEmail = `e2e-${Date.now()}@client.test`;
    const ticketId = "550e8400-e29b-41d4-a716-446655440099";

    // Use 127.0.0.1 to match Supabase site_url (not localhost)
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: testEmail,
      options: {
        redirectTo: `http://127.0.0.1:3000/track/${ticketId}`,
      },
    });

    if (!linkData?.properties?.action_link) {
      throw new Error("Failed to generate magic link");
    }

    await page.goto(linkData.properties.action_link);
    // Supabase appends #access_token to the redirect URL; wait for client-side
    // auth to process and navigate to /track/{ticketId}
    await expect(page).toHaveURL(new RegExp(`/track/${ticketId}`), {
      timeout: 15_000,
    });
  });
});
