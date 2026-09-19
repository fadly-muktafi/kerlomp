import { expect, test } from "@playwright/test";
import { cleanupSeed, createSeedGroup, memberPage } from "./seed";

test("dashboard menampilkan Tugasku lintas grup terurut deadline", async ({
  browser,
}) => {
  const seed = await createSeedGroup();
  try {
    const page = await memberPage(browser, seed.email, seed.password);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Tugasku" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tugas E2E" })).toBeVisible();
    await expect(page.getByText("Belum", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Grup E2E/ }),
    ).toBeVisible();
  } finally {
    await cleanupSeed(seed);
  }
});
