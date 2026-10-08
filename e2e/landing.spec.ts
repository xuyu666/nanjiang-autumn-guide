import { expect, test } from "@playwright/test";

test("shows the two route fields and account dialog when a guest requests a guide", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByLabel("从哪里出发")).toBeVisible();
  await expect(page.getByLabel("想去哪里")).toBeVisible();
  await expect(page.locator("#travel-form input")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "登录 / 注册" })).toBeVisible();
  await expect(page.locator("#config-note")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("landing-desktop.png"), fullPage: true });

  await page.getByLabel("从哪里出发").fill("杭州");
  await page.getByLabel("想去哪里").fill("黄山");
  await page.getByRole("button", { name: "生成旅行攻略" }).click();
  await expect(page.getByRole("dialog", { name: "登录账户" })).toBeVisible();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await expect(page.getByRole("dialog", { name: "创建账户" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("keeps the landing form within a narrow mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByLabel("从哪里出发")).toBeVisible();
  await expect(page.getByLabel("想去哪里")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("landing-mobile.png"), fullPage: true });

  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
});
