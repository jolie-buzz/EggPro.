import { z } from "zod";
import { expenseCategories, methods } from "../utils/calculations";
const key = z.string().min(1).max(200),
  str = z.string().max(10000),
  int = z.number().int().nonnegative().safe(),
  num = z.number().finite().nonnegative(),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (d) =>
        !Number.isNaN(Date.parse(d)) &&
        new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d,
    ),
  time = z.string().datetime();
const base = { id: key, created_at: time },
  updated = { ...base, updated_at: time };
export const rowSchemas = {
  farms: z.object({ ...updated, name: key, owner: str }).strict(),
  settings: z
    .object({
      id: z.enum(["currency", "prices"]),
      value: str,
      updated_at: time,
    })
    .strict(),
  cages: z
    .object({
      ...updated,
      farm_id: key,
      cage_number: key,
      name: str,
      hen_count: int,
      status: z.enum(["active", "inactive"]),
      notes: str,
    })
    .strict(),
  daily_production: z
    .object({
      ...updated,
      date,
      cage_id: key,
      hen_count_snapshot: int,
      egg_count: int,
      notes: str,
    })
    .strict(),
  egg_sorting: z
    .object({ ...updated, date, size: key, quantity: int })
    .strict(),
  egg_inventory: z
    .object({ id: key, quantity: int, updated_at: time })
    .strict(),
  feed_items: z
    .object({
      ...updated,
      name: key,
      brand: str,
      sack_weight_kg: num.positive(),
      cost_per_sack: int,
      quantity_kg: num,
      average_cost: num,
      reorder_level_kg: num,
    })
    .strict(),
  feed_purchases: z
    .object({
      ...base,
      feed_id: key,
      date,
      supplier: str,
      sacks: num.positive(),
      sack_weight_kg: num.positive(),
      cost_per_sack: int,
      total_cost: int,
    })
    .strict(),
  feed_usage: z
    .object({
      ...base,
      feed_id: key,
      date,
      quantity_kg: num.positive(),
      cost_per_kg_snapshot: num,
      total_cost: int,
      notes: str,
    })
    .strict(),
  customers: z
    .object({ ...updated, name: key, phone: str, address: str, notes: str })
    .strict(),
  sales: z
    .object({
      ...base,
      customer_id: key.nullable(),
      date,
      subtotal: int,
      discount: int,
      total: int,
      notes: str,
    })
    .strict(),
  sale_items: z
    .object({
      id: key,
      sale_id: key,
      size: key,
      quantity: num.positive(),
      unit: z.enum(["Egg", "Tray"]),
      eggs: int.positive(),
      price_snapshot: int,
      total: int,
    })
    .strict(),
  payments: z
    .object({
      ...base,
      sale_id: key,
      date,
      amount: int.positive(),
      method: z.enum(["Cash", "GCash", "Bank Transfer"]),
      notes: str,
    })
    .strict(),
  expenses: z
    .object({
      ...updated,
      date,
      category: z.enum(expenseCategories),
      description: key,
      amount: int,
      supplier: str,
      notes: str,
      feed_purchase_id: key.nullable(),
    })
    .strict(),
  alerts: z.object({ ...base, cage_id: key, date, message: str }).strict(),
  backup_metadata: z
    .object({ ...base, date: time, schema_version: int })
    .strict(),
};
