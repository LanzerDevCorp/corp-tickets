import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Turnstile is currently disabled (see docs/technical-debt.md).
 * When re-enabled, set CF test keys in .env for E2E:
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
 *   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
 */
test.describe("Formulario público de tickets", () => {
  let categoryId: string;

  test.beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      test.skip();
      return;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin
      .from("categories")
      .upsert({ name: "Soporte técnico", is_enabled: true }, { onConflict: "name" })
      .select("id")
      .single();

    if (error || !data) throw new Error("No se pudo crear categoría de prueba");
    categoryId = data.id;
  });

  test("muestra el formulario en la página principal", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /enviar ticket de soporte/i })
    ).toBeVisible();

    await expect(page.getByLabel(/nombre/i)).toBeVisible();
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/asunto/i)).toBeVisible();
    await expect(page.getByLabel(/describe tu problema/i)).toBeVisible();
  });

  test("muestra el link de acceso staff en el header", async ({ page }) => {
    await page.goto("/");

    const staffLink = page.getByRole("link", { name: /acceso staff/i });
    await expect(staffLink).toBeVisible();
    await expect(staffLink).toHaveAttribute("href", "/auth/login");
  });

  test("el toggle de prioridad tiene los 4 valores", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("radio", { name: /baja/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /media/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /alta/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /urgente/i })).toBeVisible();
  });

  test("happy path: llena el form y recibe mensaje de éxito", async ({ page }) => {
    test.skip(
      !process.env.TEST_SUPABASE_RUNNING,
      "Requiere Supabase local (TEST_SUPABASE_RUNNING=true)"
    );

    await page.goto("/");

    await page.getByLabel(/nombre/i).fill("María García");
    await page.getByLabel(/correo electrónico/i).fill("maria@empresa.mx");
    await page.getByLabel(/asunto/i).fill("No puedo acceder al sistema");

    // Select category
    await page.getByRole("combobox", { name: /categoría/i }).click();
    await page.getByRole("option", { name: /soporte técnico/i }).click();

    // Priority toggle
    await page.getByRole("radio", { name: /alta/i }).click();

    await page.getByLabel(/describe tu problema/i).fill(
      "Desde esta mañana no puedo iniciar sesión. He intentado restablecer la contraseña y sigue sin funcionar."
    );

    // Turnstile disabled — submit without captcha wait
    await page.getByRole("button", { name: /enviar ticket/i }).click();

    await expect(
      page.getByRole("heading", { name: /ticket recibido/i })
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/te enviaremos un correo/i)).toBeVisible();
    await expect(page.getByText(/referencia/i)).toBeVisible();
  });

  test("muestra error de validación cuando el email es inválido", async ({ page }) => {
    await page.goto("/");

    const emailField = page.getByLabel(/correo electrónico/i);
    await emailField.fill("no-es-un-correo");
    await emailField.blur();

    await expect(
      page.getByText(/correo electrónico válido/i)
    ).toBeVisible();
  });

  test("el botón enviar está deshabilitado con formulario vacío", async ({ page }) => {
    await page.goto("/");

    const submitBtn = page.getByRole("button", { name: /enviar ticket/i });
    await expect(submitBtn).toBeDisabled();
  });
});
