import { expect, test } from "@playwright/test";
import { cleanupSeed, createSeedGroup } from "./seed";

test("guest join lalu baca board dan detail read-only", async ({ page }) => {
  const seed = await createSeedGroup();
  try {
    await page.goto(`/join/${seed.inviteToken}`);
    await expect(
      page.getByRole("heading", { name: /Gabung ke/ }),
    ).toBeVisible();

    await page.getByLabel("Nama kamu").fill("Rani E2E");
    await page.getByRole("button", { name: "Gabung" }).click();

    await expect(page).toHaveURL(new RegExp(`/g/${seed.groupId}`));
    await expect(page.getByText("Tamu", { exact: true })).toBeVisible();
    await expect(page.getByText("Tugas E2E")).toBeVisible();
    await expect(page.getByText("Tambah tugas")).toHaveCount(0);

    await page.getByRole("link", { name: "Tugas E2E" }).click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${seed.taskId}`));
    await expect(page.getByText("Kembali ke Grup E2E")).toBeVisible();
    await expect(page.getByRole("button", { name: "Serahkan bukti" })).toHaveCount(0);
  } finally {
    await cleanupSeed(seed);
  }
});