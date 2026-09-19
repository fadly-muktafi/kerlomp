import { expect, test } from "@playwright/test";
import { cleanupSeed, createSeedGroup, memberPage } from "./seed";

/**
 * Guest tidak punya JWT, jadi realtime-nya via broadcast sinyal dari member
 * yang beraksi (via channel yang sama) + refetch via API.
 */
test("guest melihat komentar realtime (muncul dan hilang) tanpa reload", async ({
  browser,
}) => {
  const seed = await createSeedGroup();
  try {
    // jendela A: leader; jendela B: guest join via UI
    const leaderPage = await memberPage(browser, seed.email, seed.password);
    await leaderPage.goto(`/g/${seed.groupId}/tasks/${seed.taskId}`);
    await expect(leaderPage.getByRole("heading", { name: "Diskusi" })).toBeVisible();

    // jendela B: guest join via UI (context baru tanpa sesi)
    const guestContext = await browser.newContext({
      proxy: {
        server: process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "direct://",
        bypass: "127.0.0.1,localhost,mxkakvvogoflustxipfc.supabase.co",
      },
    });
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/join/${seed.inviteToken}`);
    await guestPage.getByLabel("Nama kamu").fill("Tamu Broadcast");
    await guestPage.getByRole("button", { name: "Gabung" }).click();
    await expect(guestPage).toHaveURL(new RegExp(`/g/${seed.groupId}`));

    await guestPage.goto(`/g/${seed.groupId}/tasks/${seed.taskId}`);
    await expect(guestPage.getByRole("heading", { name: "Diskusi" })).toBeVisible();
    await expect(guestPage.getByText("Tambah komentar")).toHaveCount(0);

    // leader menulis komentar via UI -> guest HARUS melihat tanpa reload
    await leaderPage.getByLabel("Tambah komentar").fill("Komentar untuk tamu");
    await leaderPage.getByRole("button", { name: "Kirim" }).click();

    await expect(guestPage.getByText("Komentar untuk tamu")).toBeVisible({
      timeout: 8000,
    });

    // leader menghapus komentarnya -> guest HARUS melihat hilang tanpa reload
    const deleteForm = leaderPage.getByLabel("Hapus komentar");
    await deleteForm.click();
    await expect(guestPage.getByText("Komentar untuk tamu")).toHaveCount(0, {
      timeout: 8000,
    });
  } finally {
    await cleanupSeed(seed);
  }
});
