import { Database } from "../database/database";
import { FarmRepository } from "../repositories/farm";
import { ProductionRepository } from "../repositories/production";
import { InventoryRepository } from "../repositories/inventory";
import { SalesRepository } from "../repositories/sales";
import { ExpenseRepository } from "../repositories/expenses";
import { BackupService } from "./backup";
import { assert } from "./validation";
import { today, shiftDate } from "../utils/calculations";
// Explicit opt-in only, and only on a farm without operating records.
export async function loadDemo(db: Database) {
  const farm = new FarmRepository(db),
    before = await farm.snapshot();
  assert(
    !before.daily_production.length &&
      !before.sales.length &&
      !before.feed_purchases.length &&
      !before.expenses.length &&
      !before.customers.length &&
      !before.egg_sorting.length,
    "Demo data can only be added to a new farm with no operating records.",
  );
  const backup = new BackupService(db),
    restore = await backup.export();
  try {
    const prod = new ProductionRepository(db),
      inv = new InventoryRepository(db),
      sales = new SalesRepository(db),
      expenses = new ExpenseRepository(db);
    const feedId = before.feed_items[0].id;
    await inv.purchase({
      feedId,
      date: shiftDate(today(), -6),
      supplier: "Demo Feed Supply",
      sacks: 8,
      weight: 50,
      cost: 1530,
    });
    for (let n = -6; n <= 0; n++) {
      const date = shiftDate(today(), n);
      let eggs = 0;
      for (let i = 0; i < before.cages.length; i++) {
        const c = before.cages[i];
        if (c.status !== "active") continue;
        const count =
          i === 30
            ? 1
            : Math.max(0, c.hen_count - ((i + n + 7) % 5 === 0 ? 2 : 0));
        await prod.save(date, c.id, count);
        eggs += count;
      }
      const small = Math.floor(eggs * 0.1),
        large = Math.floor(eggs * 0.35),
        xl = Math.floor(eggs * 0.1),
        cracked = Math.floor(eggs * 0.015);
      await inv.sort(date, {
        Small: small,
        Medium: eggs - small - large - xl - cracked,
        Large: large,
        XL: xl,
        Cracked: cracked,
        Damaged: 0,
        Dirty: 0,
      });
      await inv.use({
        feedId,
        date,
        kg: Math.max(
          0.1,
          before.cages.reduce(
            (n, c) => n + (c.status === "active" ? c.hen_count : 0),
            0,
          ) * 0.11,
        ),
        notes: "Demo daily feeding",
      });
    }
    await sales.customer({
      name: "Demo · Juan Store",
      phone: "",
      address: "Local market",
      notes: "Sample customer",
    });
    const customer = (await farm.snapshot()).customers[0];
    const available = (await farm.snapshot()).egg_inventory.find(
      (s) => s.id === "Medium",
    )!.quantity;
    if (available >= 30)
      await sales.save({
        customerId: customer.id,
        date: today(),
        items: [{ size: "Medium", quantity: 1, unit: "Tray", price: 22500 }],
        discount: 0,
        paid: 10000,
        method: "Cash",
        notes: "Demo sale",
      });
    await expenses.save({
      date: today(),
      category: "Labor",
      description: "Demo · farm helper",
      amount: 35000,
      supplier: "",
      notes: "Sample expense",
    });
  } catch (error) {
    await backup.import(JSON.stringify(restore));
    throw error;
  }
}
