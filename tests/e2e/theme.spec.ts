import { expect, test } from "@playwright/test";

test("tema tersimpan diterapkan sebelum paint", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kerlomp-theme", "dark");
  });

  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/dark/);
});