import { it, expect } from "vitest";
import { fixture } from "./helpers";
import { InventoryRepository } from "../src/repositories/inventory";
import { categories, today, shiftDate } from "../src/utils/calculations";
import type { Category } from "../src/types/models";
const counts = (n: number) =>
  Object.fromEntries(
    categories.map((s) => [s, s === "Medium" ? n : 0]),
  ) as Record<Category, number>;
it("sorting applies deltas without double counting", async () => {
  const { db, farm } = await fixture();
  const r = new InventoryRepository(db);
  await r.sort(today(), counts(60));
  await r.sort(today(), counts(60));
  expect(
    (await farm.snapshot()).egg_inventory.find((s) => s.id === "Medium")
      ?.quantity,
  ).toBe(60);
  await r.sort(today(), counts(45));
  expect(
    (await farm.snapshot()).egg_inventory.find((s) => s.id === "Medium")
      ?.quantity,
  ).toBe(45);
});
it("feed purchase records stock and expense atomically; consumption uses weighted cost", async () => {
  const { db, farm } = await fixture();
  const r = new InventoryRepository(db),
    feedId = (await farm.snapshot()).feed_items[0].id;
  await r.purchase({
    feedId,
    date: shiftDate(today(), -1),
    supplier: "Feed shop",
    sacks: 1,
    weight: 50,
    cost: 1500,
  });
  await r.purchase({
    feedId,
    date: today(),
    supplier: "Feed shop",
    sacks: 1,
    weight: 50,
    cost: 2000,
  });
  await r.use({ feedId, date: today(), kg: 20, notes: "" });
  const s = await farm.snapshot();
  expect(s.feed_items[0].quantity_kg).toBe(80);
  expect(s.feed_items[0].average_cost).toBe(3500);
  expect(s.feed_usage[0].total_cost).toBe(70000);
  expect(s.expenses).toHaveLength(2);
  await expect(
    r.use({ feedId, date: today(), kg: 81, notes: "" }),
  ).rejects.toThrow("Not enough");
  expect((await farm.snapshot()).feed_usage).toHaveLength(1);
});
it("rejects backdated consumption before available stock and recalculates late purchases", async () => {
  const { db, farm } = await fixture();
  const r = new InventoryRepository(db),
    feedId = (await farm.snapshot()).feed_items[0].id;
  await r.purchase({
    feedId,
    date: today(),
    supplier: "",
    sacks: 1,
    weight: 50,
    cost: 1500,
  });
  await expect(
    r.use({ feedId, date: shiftDate(today(), -1), kg: 10, notes: "" }),
  ).rejects.toThrow();
  await r.use({ feedId, date: today(), kg: 10, notes: "" });
  await r.purchase({
    feedId,
    date: shiftDate(today(), -1),
    supplier: "",
    sacks: 1,
    weight: 50,
    cost: 2000,
  });
  expect((await farm.snapshot()).feed_usage[0].total_cost).toBe(35000);
});
