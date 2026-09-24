import { z } from "zod";
import { today } from "../utils/calculations";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (d) =>
      !Number.isNaN(Date.parse(d)) &&
      new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d,
    "Enter a valid date",
  )
  .refine((d) => d <= today(), "Future dates are not allowed");
export const quantity = z.number().finite().nonnegative().max(100000000);
export const integer = quantity.int();
export const positive = quantity.positive();
export const text = z.string().trim().min(1).max(200);
export const note = z.string().max(2000);
export const setupSchema = z.object({
  name: text,
  owner: z.string().max(200),
  cages: integer.min(1).max(5000),
  hens: integer.min(1).max(10000),
  currency: z.enum(["PHP", "USD", "EUR", "GBP", "AUD"]),
  prices: z.record(quantity),
  sackWeight: positive,
  cost: quantity,
});
export type SetupInput = z.infer<typeof setupSchema>;
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
