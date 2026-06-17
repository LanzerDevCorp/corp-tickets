import { test, expect } from "@playwright/test";

test.describe("App smoke", () => {
  test("home route responds with content", async ({ page }) => {
    const response = await page.goto("/");
    // Assert HTTP 200
    expect(response?.status()).toBe(200);
    // Assert page has some rendered content (not a blank document)
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
