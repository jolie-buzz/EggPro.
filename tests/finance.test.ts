import { it, expect } from "vitest";
import { fixture } from "./helpers";
import { ExpenseRepository } from "../src/repositories/expenses";
import { InventoryRepository } from "../src/repositories/inventory";
import { SalesRepository } from "../src/repositories/sales";
import { totals, feedDays } from "../src/services/analytics";
import { categories, today, shiftDate } from "../src/utils/calculations";
import type { Category } from "../src/types/models";
it("keeps cash purchases separate from consumption and operating profit", async () => {
  const { db, farm } = await fixture();
  const inv = new InventoryRepository(db),
    expenses = new ExpenseRepository(db),
    sales = new SalesRepository(db);
  const feedId = (await farm.snapshot()).feed_items[0].id;
  await inv.purchase({
    feedId,
    date: today(),
    supplier: "",
    sacks: 2,
    weight: 50,
    cost: 1500,
  });
  await inv.use({ feedId, date: today(), kg: 20, notes: "" });
  await expenses.save({
    date: today(),
    category: "Labor",
    description: "Daily labor",
    amount: 20000,
    supplier: "",
    notes: "",
  });
  await inv.sort(
    today(),
    Object.fromEntries(
      categories.map((c) => [c, c === "Medium" ? 60 : 0]),
    ) as Record<Category, number>,
  );
  await sales.save({
    date: today(),
    customerId: null,
    items: [{ size: "Medium", quantity: 2, unit: "Tray", price: 22500 }],
    discount: 0,
    paid: 45000,
    method: "Cash",
    notes: "",
  });
  const t = totals(await farm.snapshot(), today());
  expect(t.revenue).toBe(45000);
  expect(t.collected).toBe(45000);
  expect(t.expenses).toBe(320000);
  expect(t.feedCost).toBe(60000);
  expect(t.netCash).toBe(-275000);
  expect(t.operatingProfit).toBe(-35000);
});
it("validates expenses and allows editing without duplication", async () => {
  const { db, farm } = await fixture();
  const r = new ExpenseRepository(db),
    input = {
      date: today(),
      category: "Water",
      description: "Water",
      amount: 15000,
      supplier: "",
      notes: "",
    };
  await r.save(input);
  await r.save(
    { ...input, amount: 20000 },
    (await farm.snapshot()).expenses[0].id,
  );
  expect(totals(await farm.snapshot(), today()).expenses).toBe(20000);
  await expect(r.save({ ...input, category: "Feed" })).rejects.toThrow();
  await expect(r.save({ ...input, amount: -1 })).rejects.toThrow();
});
it("feed forecast includes missing days in elapsed-day average", async () => {
  const { db, farm } = await fixture();
  const r = new InventoryRepository(db),
    feedId = (await farm.snapshot()).feed_items[0].id;
  await r.purchase({
    feedId,
    date: shiftDate(today(), -2),
    supplier: "",
    sacks: 2,
    weight: 50,
    cost: 1500,
  });
  await r.use({ feedId, date: shiftDate(today(), -2), kg: 30, notes: "" });
  expect(feedDays(await farm.snapshot(), feedId)?.average).toBe(10);
});
