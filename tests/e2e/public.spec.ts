import { expect, test } from "@playwright/test";

test("login menampilkan tombol Google", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: /Lanjut dengan Google/ }),
  ).toBeVisible();
});

test("token undangan tidak valid menampilkan pesan yang jelas", async ({ page }) => {
  await page.goto("/join/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("Link tidak berlaku")).toBeVisible();
});

test("sign-upload tanpa sesi ditolak", async ({ request }) => {
  const response = await request.post("/api/proofs/sign-upload", {
    data: {},
  });
  expect(response.status()).toBe(401);
});

test("download dengan path tidak valid tidak membocorkan file", async ({ request }) => {
  const response = await request.get("/api/proofs/download?path=abc");
  expect([403, 404]).toContain(response.status());
});