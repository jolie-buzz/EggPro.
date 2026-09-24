import type { State } from "../types/models";
import {
  balance,
  dayRange,
  rate,
  shiftDate,
  sum,
  today,
} from "../utils/calculations";
export function saleBalance(s: State, saleId: string) {
  const sale = s.sales.find((r) => r.id === saleId);
  return sale
    ? balance(
        sale.total,
        sum(
          s.payments.filter((p) => p.sale_id === saleId),
          (p) => p.amount,
        ),
      )
    : 0;
}
export function customerBalance(s: State, id: string) {
  return sum(
    s.sales.filter((r) => r.customer_id === id),
    (r) => saleBalance(s, r.id),
  );
}
export function totals(s: State, start: string, end = start) {
  const inside = (r: { date: string }) => r.date >= start && r.date <= end;
  const production = s.daily_production.filter(inside),
    sales = s.sales.filter(inside),
    expenses = s.expenses.filter(inside),
    usage = s.feed_usage.filter(inside);
  const eggs = sum(production, (r) => r.egg_count),
    feedCost = sum(usage, (r) => r.total_cost),
    revenue = sum(sales, (r) => r.total),
    collected = sum(s.payments.filter(inside), (r) => r.amount),
    cashExpenses = sum(expenses, (r) => r.amount);
  // Feed purchases affect cash; consumption recognizes feed expense. Equipment is capital, not operating cost.
  const otherOperating = sum(
    expenses.filter(
      (r) => !["Feed", "Equipment", "Chicken Purchase"].includes(r.category),
    ),
    (r) => r.amount,
  );
  return {
    eggs,
    rate: rate(
      eggs,
      sum(production, (r) => r.hen_count_snapshot),
    ),
    feedKg: sum(usage, (r) => r.quantity_kg),
    feedCost,
    revenue,
    collected,
    expenses: cashExpenses,
    netCash: collected - cashExpenses,
    operatingProfit: revenue - otherOperating - feedCost,
    receivables: sum(
      s.sales.filter((r) => r.date <= end),
      (r) =>
        Math.max(
          0,
          r.total -
            sum(
              s.payments.filter((p) => p.sale_id === r.id && p.date <= end),
              (p) => p.amount,
            ),
        ),
    ),
  };
}
export function rankings(s: State, start: string, end: string) {
  return s.cages
    .map((c) => {
      const rows = s.daily_production.filter(
        (r) =>
          r.cage_id === c.id &&
          r.date >= start &&
          r.date <= end &&
          r.hen_count_snapshot > 0,
      );
      return {
        cage: c,
        days: rows.length,
        rate: rows.length
          ? sum(rows, (r) => rate(r.egg_count, r.hen_count_snapshot)) /
            rows.length
          : 0,
        eggs: sum(rows, (r) => r.egg_count),
      };
    })
    .filter((r) => r.days > 0)
    .sort((a, b) => b.rate - a.rate);
}
export function productionSeries(s: State, start: string, end: string) {
  return dayRange(start, end).map((date) => ({ date, ...totals(s, date) }));
}
export function feedDays(s: State, feedId: string, date = today()) {
  const feed = s.feed_items.find((f) => f.id === feedId);
  const rows = s.feed_usage.filter(
    (u) =>
      u.feed_id === feedId && u.date >= shiftDate(date, -6) && u.date <= date,
  );
  if (!rows.length) return null;
  const first = rows.map((r) => r.date).sort()[0];
  const days = dayRange(first, date).length;
  const average = sum(rows, (r) => r.quantity_kg) / days;
  return average > 0
    ? { average, days: (feed?.quantity_kg ?? 0) / average }
    : null;
}
