import { expect, test } from "@playwright/test";
import { cleanupSeed, createSeedGroup, memberPage } from "./seed";

test("komentar realtime antar jendela member: muncul dan hilang", async ({
  browser,
}) => {
  const seed = await createSeedGroup();
  try {
    // anggota kedua
    const email2 = `rt-${Date.now()}@test.local`;
    const password2 = `Pw-${Math.random().toString(36).slice(2)}-Aa1`;
    const { data: u2, error: u2Err } = await seed.admin.auth.admin.createUser({
      email: email2,
      password: password2,
      email_confirm: true,
    });
    if (u2Err || !u2.user) throw new Error(u2Err?.message ?? "gagal buat anggota 2");

    const { data: m2, error: m2Err } = await seed.admin
      .from("members")
      .insert({ group_id: seed.groupId, user_id: u2.user.id })
      .select("id")
      .single();
    if (m2Err || !m2) throw new Error(m2Err?.message ?? "gagal join anggota 2");

    // jendela A (leader) dan jendela B (anggota kedua)
    const pageA = await memberPage(browser, seed.email, seed.password);
    const pageB = await memberPage(browser, email2, password2);

    await pageA.goto(`/g/${seed.groupId}/tasks/${seed.taskId}`);
    await pageB.goto(`/g/${seed.groupId}/tasks/${seed.taskId}`);
    await expect(pageA.getByRole("heading", { name: "Diskusi" })).toBeVisible();
    await expect(pageB.getByRole("heading", { name: "Diskusi" })).toBeVisible();

    // A menulis komentar via UI -> B HARUS melihat tanpa reload
    await pageA.getByLabel("Tambah komentar").fill("Komentar dari anggota lain");
    await pageA.getByRole("button", { name: "Kirim" }).click();

    await expect(pageB.getByText("Komentar dari anggota lain")).toBeVisible({
      timeout: 8000,
    });

    // A menghapus komentarnya -> B HARUS melihat hilang tanpa reload
    await pageA.getByLabel("Hapus komentar").click();
    await expect(pageB.getByText("Komentar dari anggota lain")).toHaveCount(0, {
      timeout: 8000,
    });
  } finally {
    await cleanupSeed(seed);
  }
});
