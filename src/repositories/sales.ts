import { auditEggTimeline } from "../services/egg-ledger";
import { Database } from "../database/database";
import type { Size, Stock, Sale, Payment, Customer } from "../types/models";
import {
  assert,
  dateSchema,
  positive,
  integer,
  note,
  text,
} from "../services/validation";
import { methods } from "../utils/calculations";
import { id, stamp, insert } from "./farm";
export interface SaleDraft {
  customerId: string | null;
  date: string;
  items: {
    size: Size;
    quantity: number;
    unit: "Egg" | "Tray";
    price: number;
  }[];
  discount: number;
  paid: number;
  method: string;
  notes: string;
}
export class SalesRepository {
  constructor(private db: Database) {}
  async customer(
    input: Pick<Customer, "name" | "phone" | "address" | "notes">,
    customerId?: string,
  ) {
    text.parse(input.name);
    note.parse(input.notes);
    await this.db.transaction(async () => {
      if (customerId)
        await this.db.execute(
          "UPDATE customers SET name=?,phone=?,address=?,notes=?,updated_at=? WHERE id=?",
          [
            input.name,
            input.phone,
            input.address,
            input.notes,
            stamp(),
            customerId,
          ],
        );
      else
        await insert(this.db, "customers", {
          id: id(),
          ...input,
          created_at: stamp(),
          updated_at: stamp(),
        });
    });
  }
  async save(input: SaleDraft) {
    dateSchema.parse(input.date);
    integer.parse(input.discount);
    integer.parse(input.paid);
    note.parse(input.notes);
    assert(input.items.length > 0, "Add at least one sale item.");
    assert(
      methods.includes(input.method as (typeof methods)[number]),
      "Choose a payment method",
    );
    const items = input.items.map((item) => {
      positive.parse(item.quantity);
      integer.parse(item.price);
      assert(item.unit === "Egg" || item.unit === "Tray", "Invalid unit");
      const eggs = Math.round(item.quantity * (item.unit === "Tray" ? 30 : 1));
      assert(
        Math.abs(eggs - item.quantity * (item.unit === "Tray" ? 30 : 1)) <
          0.000001,
        "Quantity must convert to a whole number of eggs.",
      );
      assert(eggs > 0, "At least one egg is required");
      return { ...item, eggs, total: Math.round(item.quantity * item.price) };
    });
    const subtotal = items.reduce((n, i) => n + i.total, 0),
      total = subtotal - input.discount;
    assert(total >= 0, "Discount cannot exceed subtotal.");
    assert(input.paid <= total, "Payment cannot exceed sale total.");
    assert(
      input.customerId || input.paid === total,
      "Choose a customer for an unpaid balance.",
    );
    assert(
      input.method !== "Credit / Utang" || input.paid === 0,
      "Choose Cash, GCash or Bank Transfer for a payment.",
    );
    return this.db.transaction(async () => {
      const stock = await this.db.query<Stock>("SELECT * FROM egg_inventory");
      assert(
        items.every((i) => stock.some((s) => s.id === i.size)),
        "Invalid egg size",
      );
      for (const { id: size } of stock) {
        const requested = items
            .filter((i) => i.size === size)
            .reduce((n, i) => n + i.eggs, 0),
          available = stock.find((s) => s.id === size)?.quantity ?? 0;
        assert(
          available >= requested,
          `Not enough ${size} eggs in inventory. Available: ${available} eggs. Requested: ${requested} eggs.`,
        );
      }
      const saleId = id(),
        now = stamp();
      await insert(this.db, "sales", {
        id: saleId,
        customer_id: input.customerId,
        date: input.date,
        subtotal,
        discount: input.discount,
        total,
        notes: input.notes,
        created_at: now,
      });
      for (const item of items) {
        await insert(this.db, "sale_items", {
          id: id(),
          sale_id: saleId,
          size: item.size,
          quantity: item.quantity,
          unit: item.unit,
          eggs: item.eggs,
          price_snapshot: item.price,
          total: item.total,
        });
        await this.db.execute(
          "UPDATE egg_inventory SET quantity=quantity-?,updated_at=? WHERE id=?",
          [item.eggs, now, item.size],
        );
      }
      if (input.paid > 0)
        await insert(this.db, "payments", {
          id: id(),
          sale_id: saleId,
          date: input.date,
          amount: input.paid,
          method: input.method,
          notes: "Payment at sale",
          created_at: now,
        });
      await auditEggTimeline(this.db);
      return saleId;
    });
  }
  async pay(input: {
    saleId: string;
    date: string;
    amount: number;
    method: string;
    notes: string;
  }) {
    dateSchema.parse(input.date);
    integer.positive().parse(input.amount);
    assert(
      ["Cash", "GCash", "Bank Transfer"].includes(input.method),
      "Choose a payment method.",
    );
    await this.db.transaction(async () => {
      const [sale] = await this.db.query<Sale>(
        "SELECT * FROM sales WHERE id=?",
        [input.saleId],
      );
      assert(sale, "Sale not found");
      assert(
        input.date >= sale.date,
        "Payment date cannot be before the sale.",
      );
      const payments = await this.db.query<Payment>(
        "SELECT * FROM payments WHERE sale_id=?",
        [sale.id],
      );
      const due = sale.total - payments.reduce((n, p) => n + p.amount, 0);
      assert(input.amount <= due, "Payment exceeds the outstanding balance.");
      await insert(this.db, "payments", {
        id: id(),
        sale_id: sale.id,
        date: input.date,
        amount: input.amount,
        method: input.method,
        notes: input.notes,
        created_at: stamp(),
      });
    });
  }
}
