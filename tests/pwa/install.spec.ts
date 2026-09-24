import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

test("production PWA has valid install metadata and opens its cached shell offline", async ({
  page,
}) => {
  // Stop a real asset server to test an unavailable origin. This also avoids
  // WebKit automation's offline-mode navigation failure before SW dispatch.
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    const file = resolve("dist", path === "/" ? "index.html" : "." + path);
    try {
      if (!file.startsWith(resolve("dist") + "/")) throw new Error();
      const body = await readFile(file);
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  try {
    await page.goto(origin);
    await expect(page).toHaveTitle("EggPro");
    const manifest = await (
      await page.request.get(origin + "/manifest.webmanifest")
    ).json();
    expect(manifest.name).toBe("EggPro");
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons) {
      const response = await page.request.get(origin + icon.src);
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
    await new Promise<void>((r) => {
      server.close(() => r());
      server.closeAllConnections();
    });
    expect(
      await page.evaluate(() =>
        fetch("/api/offline-probe").then(
          () => false,
          () => true,
        ),
      ),
    ).toBe(true);
    await page.reload();
    await expect(page).toHaveTitle("EggPro");
    await expect(page.locator("#root")).not.toBeEmpty();
  } finally {
    server.close();
    server.closeAllConnections();
  }
});

test("iPhone installation guide works before cloud setup and hides in the installed app", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.goto("/");
  const button = page.getByRole("button", {
    name: "Install EggPro on iPhone / iPad",
  });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("heading", { name: "Add EggPro to your Home Screen" }),
  ).toBeVisible();
  await expect(
    page.getByText("Open as Web App", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/iphone-install-guide.png",
    fullPage: true,
  });
  await button.click();
  await expect(
    page.getByRole("heading", { name: "Add EggPro to your Home Screen" }),
  ).toHaveCount(0);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  await page.reload();
  await expect(button).toHaveCount(0);
  await context.close();
});
