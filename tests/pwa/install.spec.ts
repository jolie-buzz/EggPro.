import { test, expect } from "@playwright/test";
test("production PWA has valid install metadata and opens its cached shell offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("EggPro");
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.name).toBe("EggPro");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle("EggPro");
  await expect(page.locator("#root")).not.toBeEmpty();
});
