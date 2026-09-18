import { expect, test } from "@playwright/test";

test("font self-host terpasang, bukan fallback", async ({ page }) => {
  await page.goto("/");

  // next/font/local menaruh family hasil generate ke variabel ini di <html>.
  // Kalau unduhan/aset gagal, variabelnya kosong dan body memakai fallback.
  const values = await page.evaluate(() => ({
    sans: getComputedStyle(document.documentElement)
      .getPropertyValue("--font-plus-jakarta")
      .trim(),
    loaded: document.fonts.size,
  }));

  expect(values.sans.length).toBeGreaterThan(0);
  expect(values.loaded).toBeGreaterThan(0);
});