import { it, expect } from "vitest";
import { fixture } from "./helpers";
import { InventoryRepository } from "../src/repositories/inventory";
import { SalesRepository, type SaleDraft } from "../src/repositories/sales";
import { customerBalance, saleBalance } from "../src/services/analytics";
import { categories, today } from "../src/utils/calculations";
import type { Category } from "../src/types/models";
async function salesFixture() {
  const f = await fixture();
  const inventory = new InventoryRepository(f.db),
    repo = new SalesRepository(f.db);
  await inventory.sort(
    today(),
    Object.fromEntries(
      categories.map((s) => [s, s === "Medium" ? 100 : 0]),
    ) as Record<Category, number>,
  );
  await repo.customer({
    name: "Juan Store",
    phone: "",
    address: "",
    notes: "",
  });
  const customerId = (await f.farm.snapshot()).customers[0].id;
  const draft: SaleDraft = {
    customerId,
    date: today(),
    items: [{ size: "Medium", quantity: 2, unit: "Tray", price: 22500 }],
    discount: 0,
    paid: 10000,
    method: "Cash",
    notes: "",
  };
  return { ...f, repo, inventory, draft };
}
it("sale deducts stock, stores snapshots and supports partial payments", async () => {
  const { repo, farm, draft } = await salesFixture();
  const saleId = await repo.save(draft);
  let s = await farm.snapshot();
  expect(s.egg_inventory.find((r) => r.id === "Medium")?.quantity).toBe(40);
  expect(saleBalance(s, saleId)).toBe(35000);
  expect(customerBalance(s, draft.customerId!)).toBe(35000);
  await repo.pay({
    saleId,
    date: today(),
    amount: 15000,
    method: "GCash",
    notes: "",
  });
  s = await farm.snapshot();
  expect(saleBalance(s, saleId)).toBe(20000);
  await expect(
    repo.pay({
      saleId,
      date: today(),
      amount: 20001,
      method: "Cash",
      notes: "",
    }),
  ).rejects.toThrow();
  await repo.pay({
    saleId,
    date: today(),
    amount: 20000,
    method: "Cash",
    notes: "",
  });
  expect(saleBalance(await farm.snapshot(), saleId)).toBe(0);
  expect(s.sale_items[0].price_snapshot).toBe(22500);
});
it("insufficient aggregate inventory rolls back all sale effects", async () => {
  const { repo, farm, draft } = await salesFixture();
  await expect(
    repo.save({ ...draft, items: [...draft.items, ...draft.items] }),
  ).rejects.toThrow("Not enough");
  const s = await farm.snapshot();
  expect(s.sales).toHaveLength(0);
  expect(s.payments).toHaveLength(0);
  expect(s.egg_inventory.find((r) => r.id === "Medium")?.quantity).toBe(100);
});
it("serializes concurrent sales and disallows reducing sold stock", async () => {
  const { repo, farm, draft, inventory } = await salesFixture();
  const results = await Promise.allSettled([
    repo.save(draft),
    repo.save(draft),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await expect(
    inventory.sort(
      today(),
      Object.fromEntries(categories.map((s) => [s, 0])) as Record<
        Category,
        number
      >,
    ),
  ).rejects.toThrow("already been sold");
  expect(
    (await farm.snapshot()).egg_sorting.find((r) => r.size === "Medium")
      ?.quantity,
  ).toBe(100);
});
it("requires customer for credit and whole eggs for partial trays", async () => {
  const { repo, draft } = await salesFixture();
  await expect(repo.save({ ...draft, customerId: null })).rejects.toThrow(
    "customer",
  );
  await expect(
    repo.save({ ...draft, items: [{ ...draft.items[0], quantity: 0.01 }] }),
  ).rejects.toThrow("whole number");
});
it("rejects backdated sale before its collection even when current stock is sufficient", async () => {
  const { repo, draft } = await salesFixture();
  const { shiftDate } = await import("../src/utils/calculations");
  await expect(
    repo.save({ ...draft, date: shiftDate(today(), -1) }),
  ).rejects.toThrow("historical stock");
});
