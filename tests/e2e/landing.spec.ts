import { expect, test } from "@playwright/test";

test("landing merender CTA utama", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Coba Gratis" })).toBeVisible();
});