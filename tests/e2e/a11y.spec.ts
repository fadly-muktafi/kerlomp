import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SERIOUS = ["serious", "critical"];

async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  return results.violations.filter((violation) =>
    SERIOUS.includes(violation.impact ?? ""),
  );
}

test("landing tanpa pelanggaran a11y serius", async ({ page }) => {
  await page.goto("/");
  expect(await seriousViolations(page)).toEqual([]);
});

test("login tanpa pelanggaran a11y serius", async ({ page }) => {
  await page.goto("/login");
  expect(await seriousViolations(page)).toEqual([]);
});