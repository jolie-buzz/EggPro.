import { test, expect, type Page } from "@playwright/test";
async function tab(p: Page, name: string) {
  await p
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function more(p: Page, name: string) {
  await tab(p, "More");
  await p.getByRole("button", { name, exact: false }).click();
}
async function setup(p: Page, cages = "50") {
  await p.goto("/");
  await p.getByLabel("Farm name", { exact: true }).fill("QA Sunrise Farm");
  await p.getByLabel("Number of cages").fill(cages);
  await p.getByRole("button", { name: "Create my farm" }).click();
  await expect(
    p.getByRole("heading", { name: "Your farm, at a glance" }),
  ).toBeVisible();
}
test("end-to-end local farm workflow, backup and reload", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  page.on("dialog", (d) => d.accept());
  await setup(page);
  await page.screenshot({ path: info.outputPath("home-empty.png") });
  await tab(page, "Production");
  await page
    .getByRole("button", { name: "Add egg Cage 001", exact: true })
    .click();
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "1",
  );
  await page.getByLabel("Eggs Cage 001", { exact: true }).fill("4");
  await page.getByLabel("Eggs Cage 001", { exact: true }).press("Tab");
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "4",
  );
  await page
    .getByRole("button", { name: "Subtract egg Cage 001", exact: true })
    .click();
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "3",
  );
  await page.screenshot({ path: info.outputPath("production.png") });
  await page.reload();
  await tab(page, "Production");
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "3",
  );
  await more(page, "Cage management");
  await page
    .getByRole("button", { name: "Edit Cage 001", exact: true })
    .click();
  await page.getByLabel("Hens", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await tab(page, "Production");
  await expect(page.locator(".production-row").first()).toContainText("4 hens");
  await tab(page, "Inventory");
  await page.getByRole("button", { name: "Sort collection" }).click();
  await page.getByLabel("Medium eggs sorted").fill("90");
  await page
    .getByRole("button", { name: "Save sorting & update stock" })
    .click();
  await expect(page.getByRole("status")).toContainText("Sorting saved");
  await page
    .getByRole("button", { name: "Save sorting & update stock" })
    .click();
  await expect(page.getByRole("status")).toContainText("Sorting saved");
  await more(page, "Feed management");
  await page.getByRole("button", { name: "Buy feed", exact: true }).click();
  await page.getByLabel("Number of sacks").fill("2");
  await page.getByRole("button", { name: "Save purchase & expense" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".stat").filter({ hasText: "Remaining" }).first(),
  ).toContainText("100 kg");
  await page
    .getByRole("button", { name: "Record feed used", exact: true })
    .click();
  await page.getByLabel("Quantity used (kg)").fill("22.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".stat").filter({ hasText: "Remaining" }).first(),
  ).toContainText("77.5 kg");
  await page.screenshot({ path: info.outputPath("feed.png") });
  await more(page, "Customers");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("QA Juan Store");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await tab(page, "Sales");
  await page.getByRole("button", { name: "New sale", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption({ label: "QA Juan Store" });
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Amount paid").fill("100");
  await page.getByRole("button", { name: "Save sale & update stock" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /QA Juan Store/ }),
  ).toContainText("₱350.00 due");
  await page.getByRole("button", { name: "Receivables", exact: true }).click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(
    page.getByRole("heading", { name: "No outstanding balances" }),
  ).toBeVisible();
  await more(page, "Expenses");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Labor");
  await page.getByLabel("Description", { exact: true }).fill("QA helper");
  await page.getByLabel("Amount", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("QA helper", { exact: true })).toBeVisible();
  await more(page, "Farm finances");
  await expect(page.getByText("₱450.00", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: info.outputPath("finances.png") });
  await more(page, "Reports & cage rankings");
  for (const option of [
    "Daily Production",
    "Weekly Production",
    "Monthly Production",
    "Cage Performance",
    "Feed Consumption",
    "Egg Inventory",
    "Sales",
    "Customer Sales",
    "Receivables",
    "Expenses",
    "Profit",
  ]) {
    await page
      .getByRole("combobox", { name: "Report", exact: true })
      .selectOption(option);
    await expect(
      page.getByRole("heading", { name: option, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await more(page, "Backup & restore");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const file = await download;
  const path = info.outputPath("farm-backup.json");
  await file.saveAs(path);
  await page.getByLabel("Choose backup file").setInputFiles(path);
  await expect(
    page.getByRole("heading", { name: "QA Sunrise Farm" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace farm data" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Backup restored successfully",
  );
  await page.reload();
  await tab(page, "Inventory");
  await expect(
    page.locator(".egg-stock").filter({ hasText: "Medium" }),
  ).toContainText("30");
  expect(errors).toEqual([]);
  await tab(page, "Home");
  await page.screenshot({ path: info.outputPath("home-populated.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: info.outputPath("home-375.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: info.outputPath("home-desktop.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("off-happy-path inventory error and invalid backup preserve farm", async ({
  page,
}) => {
  await setup(page, "2");
  await tab(page, "Sales");
  await page.getByRole("button", { name: "New sale" }).click();
  await page.getByRole("button", { name: "Mark paid in full" }).click();
  await page.getByRole("button", { name: "Save sale & update stock" }).click();
  await expect(page.getByRole("alert")).toContainText("Not enough Medium eggs");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await more(page, "Backup & restore");
  await page
    .getByLabel("Choose backup file")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(page.getByRole("status")).toContainText(
    "not a supported EggPro/FarmTrack backup",
  );
  await tab(page, "Home");
  await expect(page.locator(".farm-name")).toBeVisible();
});
test("production bulk actions, cage lifecycle, settings, and searching", async ({
  page,
}, info) => {
  await setup(page, "2");
  page.on("dialog", (d) => d.accept());
  await tab(page, "Production");
  await page.getByLabel("Eggs Cage 001", { exact: true }).fill("12");
  await expect(page.locator(".production-row").first()).not.toContainText(
    "Saving…",
  );
  await page.reload();
  await tab(page, "Production");
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "12",
  );
  await page
    .getByRole("button", { name: "Add egg Cage 001", exact: true })
    .click({ clickCount: 3 });
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "15",
  );
  await page.getByText("Day actions", { exact: true }).click();
  await page.getByRole("button", { name: "Set all zero" }).click();
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "0",
  );
  await expect(page.getByLabel("Eggs Cage 002", { exact: true })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Clear entries" }).click();
  await expect(page.locator(".production-row").first()).toContainText(
    "No record",
  );
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const d = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Production date").fill(d);
  await page.getByLabel("Eggs Cage 001", { exact: true }).fill("4");
  await expect(page.locator(".production-row").first()).not.toContainText(
    "Saving…",
  );
  const now = new Date(),
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Production date").fill(date);
  await page.getByRole("button", { name: "Copy yesterday" }).click();
  await expect(page.getByLabel("Eggs Cage 001", { exact: true })).toHaveValue(
    "4",
  );
  await page.getByLabel("Search production cages").fill("002");
  await expect(page.locator(".production-row")).toHaveCount(1);
  await page.getByLabel("Search production cages").fill("");
  await page
    .getByRole("combobox", { name: "Sort production" })
    .selectOption("eggs");
  await expect(page.locator(".production-row").first()).toContainText(
    "Cage 001",
  );
  await more(page, "Cage management");
  await page.getByRole("button", { name: "Add cage" }).click();
  await page.getByLabel("Cage number").fill("003");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit Cage 003", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("inactive");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Cage status" })
    .selectOption("inactive");
  await expect(page.getByText("Cage 003", { exact: true })).toBeVisible();
  await more(page, "Farm settings");
  await page.getByLabel("Farm name", { exact: true }).fill("QA Updated Farm");
  await page.getByLabel("Medium", { exact: true }).fill("230");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");
  await page.screenshot({ path: info.outputPath("settings.png") });
  await tab(page, "Sales");
  await page.getByRole("button", { name: "New sale" }).click();
  await expect(page.getByLabel("Price per tray")).toHaveValue("230");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.locator(".sale-item")).toHaveCount(2);
  await page.getByRole("button", { name: "Remove item 2" }).click();
  await expect(page.locator(".sale-item")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("sale-form.png") });
});
test("optional demo yields populated reports and alerts on a 50-cage farm", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await setup(page);
  page.on("dialog", (d) => d.accept());
  await more(page, "Sample data");
  await page.getByRole("button", { name: "Add demo records" }).click();
  await expect(page.getByRole("status")).toContainText("Sample records added", {
    timeout: 90000,
  });
  await tab(page, "Home");
  await page.screenshot({ path: info.outputPath("demo-home.png") });
  await page.getByText("Farm alerts", { exact: true }).scrollIntoViewIfNeeded();
  await expect(
    page.getByText(
      "Cage 031 has produced below 50% for 3 consecutive recorded days.",
    ),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("demo-alerts.png") });
  await more(page, "Reports & cage rankings");
  await page.screenshot({ path: info.outputPath("demo-reports.png") });
  await page
    .getByRole("combobox", { name: "Report", exact: true })
    .selectOption("Cage Performance");
  await page.screenshot({ path: info.outputPath("demo-rankings.png") });
});

test("custom egg size preserves draft counts and works across stock, sales and reload", async ({
  page,
}, info) => {
  await setup(page, "2");
  page.on("dialog", (d) => d.accept());
  await tab(page, "Inventory");
  await page.getByRole("button", { name: "Sort collection" }).click();
  await page.getByLabel("Medium eggs sorted").fill("7");
  await page.getByRole("button", { name: "Add custom size" }).click();
  await page.getByLabel("Size name").fill("Jumbo");
  await page.getByLabel("Default price per tray").fill("300");
  await page.getByRole("button", { name: "Add size", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Medium eggs sorted")).toHaveValue("7");
  await page.getByLabel("Jumbo eggs sorted").fill("30");
  await page.getByRole("button", { name: "Add custom size" }).click();
  await page.getByLabel("Size name").fill("jumbo");
  await page.getByRole("button", { name: "Add size", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Save sorting & update stock" })
    .click();
  await expect(page.getByRole("status")).toContainText("Sorting saved");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("custom-size-sorting.png"),
    fullPage: true,
  });
  await tab(page, "Sales");
  await page.getByRole("button", { name: "New sale" }).click();
  await page
    .getByRole("combobox", { name: "Egg size", exact: false })
    .selectOption("Jumbo");
  await expect(page.getByLabel("Price per tray")).toHaveValue("300");
  await page.getByRole("button", { name: "Mark paid in full" }).click();
  await page.getByRole("button", { name: "Save sale & update stock" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await tab(page, "Inventory");
  await expect(
    page.locator(".egg-stock").filter({ hasText: "Jumbo" }),
  ).toContainText("0");
  await more(page, "Farm settings");
  await expect(page.getByLabel("Jumbo", { exact: true })).toHaveValue("300");
});
