import { auditEggTimeline } from "../services/egg-ledger";
import { Database } from "../database/database";
import type {
  Category,
  Stock,
  Sorting,
  Feed,
  Purchase,
  Usage,
} from "../types/models";
import { losses, cents, weightedCost, today } from "../utils/calculations";
import {
  assert,
  dateSchema,
  integer,
  positive,
  quantity,
  text,
} from "../services/validation";
import { id, stamp, insert } from "./farm";
export class InventoryRepository {
  constructor(private db: Database) {}
  async addSize(name: string, price: number) {
    name = text.parse(name).replace(/\s+/g, " ");
    assert(name.length <= 40, "Use 40 characters or fewer for the size name.");
    assert(
      ![...losses, "__proto__", "constructor", "prototype"].some(
        (s) => s.toLowerCase() === name.toLowerCase(),
      ),
      "Choose a size name other than a loss category or reserved name.",
    );
    quantity.parse(price);
    await this.db.transaction(async () => {
      const stock = await this.db.query<Stock>("SELECT * FROM egg_inventory");
      assert(
        !stock.some((s) => s.id.toLowerCase() === name.toLowerCase()),
        "This egg size already exists.",
      );
      const [setting] = await this.db.query<{ value: string }>(
        "SELECT value FROM settings WHERE id='prices'",
      );
      assert(setting, "Set up a farm first.");
      const prices = JSON.parse(setting.value);
      await insert(this.db, "egg_inventory", {
        id: name,
        quantity: 0,
        updated_at: stamp(),
      });
      await this.db.execute(
        "UPDATE settings SET value=?,updated_at=? WHERE id='prices'",
        [JSON.stringify({ ...prices, [name]: cents(price) }), stamp()],
      );
    });
  }
  async sort(date: string, counts: Record<Category, number>) {
    dateSchema.parse(date);
    await this.db.transaction(async () => {
      const old = await this.db.query<Sorting>(
        "SELECT * FROM egg_sorting WHERE date=?",
        [date],
      );
      const stock = await this.db.query<Stock>("SELECT * FROM egg_inventory");
      const categories = [...stock.map((r) => r.id), ...losses];
      assert(
        Object.keys(counts).every((c) => categories.includes(c)),
        "Unknown egg size.",
      );
      for (const c of categories) integer.parse(counts[c] ?? 0);
      const now = stamp();
      for (const size of categories) {
        const previous = old.find((r) => r.size === size),
          delta = (counts[size] ?? 0) - (previous?.quantity ?? 0);
        if (stock.some((r) => r.id === size)) {
          const available = stock.find((r) => r.id === size)?.quantity ?? 0;
          assert(
            available + delta >= 0,
            `Cannot reduce ${size} sorting: some eggs have already been sold. Available: ${available}; reduction: ${-delta}.`,
          );
          await this.db.execute(
            "UPDATE egg_inventory SET quantity=quantity+?,updated_at=? WHERE id=?",
            [delta, now, size],
          );
        }
        if (previous)
          await this.db.execute(
            "UPDATE egg_sorting SET quantity=?,updated_at=? WHERE id=?",
            [counts[size] ?? 0, now, previous.id],
          );
        else
          await insert(this.db, "egg_sorting", {
            id: id(),
            date,
            size,
            quantity: counts[size] ?? 0,
            created_at: now,
            updated_at: now,
          });
      }
      await auditEggTimeline(this.db);
    });
  }
  async addFeed(input: {
    name: string;
    brand: string;
    sackWeight: number;
    cost: number;
    reorder: number;
  }) {
    text.parse(input.name);
    positive.parse(input.sackWeight);
    quantity.parse(input.cost);
    quantity.parse(input.reorder);
    await this.db.transaction(() =>
      insert(this.db, "feed_items", {
        id: id(),
        name: input.name,
        brand: input.brand,
        sack_weight_kg: input.sackWeight,
        cost_per_sack: cents(input.cost),
        quantity_kg: 0,
        average_cost: 0,
        reorder_level_kg: input.reorder,
        created_at: stamp(),
        updated_at: stamp(),
      }),
    );
  }
  // Feed events are replayed chronologically so late entry cannot corrupt weighted average costing.
  private async recost(feedId: string) {
    const [feed] = await this.db.query<Feed>(
      "SELECT * FROM feed_items WHERE id=?",
      [feedId],
    );
    assert(feed, "Feed not found");
    const purchases = await this.db.query<Purchase>(
      "SELECT * FROM feed_purchases WHERE feed_id=?",
      [feedId],
    );
    const uses = await this.db.query<Usage>(
      "SELECT * FROM feed_usage WHERE feed_id=?",
      [feedId],
    );
    const events = [
      ...purchases.map((p) => ({
        date: p.date,
        kind: 0,
        created: p.created_at,
        purchase: p,
        use: null,
      })),
      ...uses.map((u) => ({
        date: u.date,
        kind: 1,
        created: u.created_at,
        purchase: null,
        use: u,
      })),
    ].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.kind - b.kind ||
        a.created.localeCompare(b.created),
    );
    let kg = 0,
      cost = 0;
    for (const e of events) {
      if (e.purchase) {
        const p = e.purchase,
          added = p.sacks * p.sack_weight_kg;
        cost = weightedCost(kg, cost, added, p.total_cost);
        kg += added;
      } else if (e.use) {
        const u = e.use;
        assert(
          kg + 0.000001 >= u.quantity_kg,
          `Not enough ${feed.name} on ${u.date}. Available: ${kg.toFixed(2)} kg; requested: ${u.quantity_kg} kg.`,
        );
        await this.db.execute(
          "UPDATE feed_usage SET cost_per_kg_snapshot=?,total_cost=? WHERE id=?",
          [cost, Math.round(cost * u.quantity_kg), u.id],
        );
        kg = Math.max(0, kg - u.quantity_kg);
      }
    }
    await this.db.execute(
      "UPDATE feed_items SET quantity_kg=?,average_cost=?,updated_at=? WHERE id=?",
      [kg, cost, stamp(), feedId],
    );
  }
  async purchase(input: {
    feedId: string;
    date: string;
    supplier: string;
    sacks: number;
    weight: number;
    cost: number;
  }) {
    dateSchema.parse(input.date);
    positive.parse(input.sacks);
    positive.parse(input.weight);
    quantity.parse(input.cost);
    await this.db.transaction(async () => {
      const now = stamp(),
        purchaseId = id(),
        total = Math.round(input.sacks * cents(input.cost));
      await insert(this.db, "feed_purchases", {
        id: purchaseId,
        feed_id: input.feedId,
        date: input.date,
        supplier: input.supplier,
        sacks: input.sacks,
        sack_weight_kg: input.weight,
        cost_per_sack: cents(input.cost),
        total_cost: total,
        created_at: now,
      });
      await insert(this.db, "expenses", {
        id: id(),
        date: input.date,
        category: "Feed",
        description: `Feed purchase · ${input.sacks} sacks × ${input.weight} kg`,
        amount: total,
        supplier: input.supplier,
        notes: "Created from feed purchase",
        feed_purchase_id: purchaseId,
        created_at: now,
        updated_at: now,
      });
      await this.db.execute(
        "UPDATE feed_items SET sack_weight_kg=?,cost_per_sack=? WHERE id=?",
        [input.weight, cents(input.cost), input.feedId],
      );
      await this.recost(input.feedId);
    });
  }
  async use(input: {
    feedId: string;
    date: string;
    kg: number;
    notes: string;
  }) {
    dateSchema.parse(input.date);
    positive.parse(input.kg);
    await this.db.transaction(async () => {
      await insert(this.db, "feed_usage", {
        id: id(),
        feed_id: input.feedId,
        date: input.date,
        quantity_kg: input.kg,
        cost_per_kg_snapshot: 0,
        total_cost: 0,
        notes: input.notes,
        created_at: stamp(),
      });
      await this.recost(input.feedId);
    });
  }
  async setReorder(feedId: string, kg: number) {
    quantity.parse(kg);
    await this.db.transaction(() =>
      this.db.execute(
        "UPDATE feed_items SET reorder_level_kg=?,updated_at=? WHERE id=?",
        [kg, stamp(), feedId],
      ),
    );
  }
}
