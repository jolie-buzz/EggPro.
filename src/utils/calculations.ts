export const sizes = ["Small", "Medium", "Large", "XL"] as const;
export const losses = ["Cracked", "Damaged", "Dirty"] as const;
export const categories = [...sizes, ...losses] as const;
export const expenseCategories = [
  "Feed",
  "Vitamins",
  "Medicine",
  "Labor",
  "Electricity",
  "Water",
  "Transportation",
  "Egg Trays",
  "Repairs",
  "Chicken Purchase",
  "Equipment",
  "Others",
] as const;
export const methods = [
  "Cash",
  "GCash",
  "Bank Transfer",
  "Credit / Utang",
] as const;
export const rate = (eggs: number, hens: number) =>
  hens > 0 ? (eggs / hens) * 100 : 0;
export const trays = (eggs: number) => eggs / 30;
export const perKg = (cost: number, kg: number) => (kg > 0 ? cost / kg : 0);
export const perEgg = (cost: number, eggs: number) =>
  eggs > 0 ? cost / eggs : 0;
export const weightedCost = (
  oldKg: number,
  oldCost: number,
  addedKg: number,
  cost: number,
) => perKg(oldKg * oldCost + cost, oldKg + addedKg);
export const balance = (total: number, paid: number) =>
  Math.max(0, total - paid);
export const cents = (value: number) => Math.round(value * 100);
export const status = (value: number | null) =>
  value === null
    ? "unrecorded"
    : value >= 75
      ? "good"
      : value >= 50
        ? "watch"
        : "low";
export const sum = <T>(rows: T[], get: (row: T) => number) =>
  rows.reduce((n, r) => n + get(r), 0);
export const today = () => localDate(new Date());
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 3660; d = shiftDate(d, 1))
    out.push(d);
  return out;
}
export const money = (minor: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(
    minor / 100,
  );
export const number = (value: number, digits = 1) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: digits }).format(
    value,
  );
