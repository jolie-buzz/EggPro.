import { test, expect, type BrowserContext, type Page } from "@playwright/test";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "qa@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = () => ({
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
});
let record: Record<string, unknown> | null;
async function mock(context: BrowserContext) {
  await context.route("https://eggpro-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const send = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: { "access-control-allow-origin": "*" },
      });
    if (url.pathname === "/auth/v1/token") return send(token());
    if (url.pathname === "/auth/v1/user") return send(user);
    if (url.pathname === "/auth/v1/logout") return send({});
    if (url.pathname === "/rest/v1/eggpro_farms") return send(record);
    if (url.pathname === "/rest/v1/rpc/save_eggpro_farm") {
      const input = req.postDataJSON();
      if (input.expected_revision !== (record?.revision ?? 0))
        return send({ code: "40001", message: "conflict" }, 409);
      record = {
        revision: (Number(record?.revision) || 0) + 1,
        document: input.new_document,
        mutation_id: input.request_id,
        updated_at: new Date().toISOString(),
      };
      return send(record);
    }
    return send({ message: "Unexpected test request" }, 400);
  });
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function tab(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
test("login persists; farm and custom sizes open on a second phone; logout clears the view", async ({
  page,
  context,
  browser,
}, info) => {
  record = null;
  await mock(context);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByLabel("Farm name", { exact: true }).fill("QA Cloud EggPro");
  await page.getByLabel("Number of cages").fill("2");
  await page.getByRole("button", { name: "Create my farm" }).click();
  await expect(
    page.getByRole("heading", { name: "Your farm, at a glance" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your farm, at a glance" }),
  ).toBeVisible();
  await tab(page, "Inventory");
  await page.getByRole("button", { name: "Sort collection" }).click();
  await page.getByRole("button", { name: "Add custom size" }).click();
  await page.getByLabel("Size name").fill("Jumbo");
  await page.getByLabel("Default price per tray").fill("300");
  await page.getByRole("button", { name: "Add size", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const other = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await mock(other);
  const phone = await other.newPage();
  await login(phone);
  await expect(
    phone.getByRole("heading", { name: "Your farm, at a glance" }),
  ).toBeVisible();
  await tab(phone, "Inventory");
  await expect(
    phone.locator(".egg-stock").filter({ hasText: "Jumbo" }),
  ).toBeVisible();
  await phone.getByText("Account & sync", { exact: true }).click();
  await phone.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(
    phone.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(phone.getByText("QA Cloud EggPro", { exact: true })).toHaveCount(
    0,
  );
  await phone.reload();
  await expect(
    phone.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await phone.screenshot({
    path: info.outputPath("eggpro-login.png"),
    fullPage: true,
  });
  await other.close();
  await page.screenshot({
    path: info.outputPath("eggpro-online-sorting.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
