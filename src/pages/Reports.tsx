import { useState } from "react";
import type { State } from "../types/models";
import { Heading, Card, Stat, Empty } from "../components/ui";
import { Period, type PeriodValue } from "../components/Period";
import { Chart } from "../components/Chart";
import {
  totals,
  rankings,
  productionSeries,
  customerBalance,
} from "../services/analytics";
import {
  money,
  number,
  perEgg,
  sum,
  today,
  shiftDate,
  trays,
} from "../utils/calculations";
export function Financial({ state, back }: { state: State; back: () => void }) {
  const [period, setPeriod] = useState<PeriodValue>({
    start: today(),
    end: today(),
  });
  const t = totals(state, period.start, period.end),
    cash = (n: number) => money(n, state.settings.currency);
  return (
    <>
      <Heading
        title="Farm finances"
        subtitle="Understand your cash and your operating result."
        back={back}
      />
      <Period value={period} onChange={setPeriod} financial />
      <div className="stats">
        <Stat label="Gross sales" value={cash(t.revenue)} />
        <Stat label="Collected cash" value={cash(t.collected)} />
        <Stat label="Receivables · at period end" value={cash(t.receivables)} />
        <Stat label="Cash expenses" value={cash(t.expenses)} />
        <Stat label="Feed consumed · cost" value={cash(t.feedCost)} />
        <Stat label="Net cash" value={cash(t.netCash)} />
      </div>
      <Card className="profit-card">
        <span className="eyebrow">ESTIMATED OPERATING PROFIT</span>
        <h2>{cash(t.operatingProfit)}</h2>
        <p>Sales revenue − feed consumed − other operating expenses</p>
      </Card>
      <Card>
        <h2>Feed cost of production</h2>
        <div className="stats two">
          <Stat
            label="Per egg"
            value={t.eggs ? cash(perEgg(t.feedCost, t.eggs)) : "—"}
          />
          <Stat
            label="Per tray · 30 eggs"
            value={t.eggs ? cash(perEgg(t.feedCost, t.eggs) * 30) : "—"}
          />
        </div>
        <p>
          {t.eggs} eggs recorded · {number(t.feedKg)} kg consumed
        </p>
      </Card>
      <Card>
        <h2>How these numbers work</h2>
        <p>
          Cash collected includes payments received in this period, even for
          older sales. Cash expenses include feed purchases, equipment, and
          chicken purchases.
        </p>
        <p>
          Operating profit recognizes feed when consumed, avoiding double
          counting feed purchases. Equipment and chicken purchases are excluded
          from operating expense; depreciation and inventory cost of eggs are
          not allocated in V1. This is an estimate, not full accrual accounting.
        </p>
        <p>
          Feed cost per egg uses production and feed consumption in the selected
          period. No eggs recorded means the cost per egg is unavailable.
        </p>
      </Card>
    </>
  );
}
const reportTypes = [
  "Daily Production",
  "Weekly Production",
  "Monthly Production",
  "Cage Performance",
  "Feed Consumption",
  "Egg Inventory",
  "Sales",
  "Customer Sales",
  "Receivables",
  "Expenses",
  "Profit",
];
export function Reports({ state, back }: { state: State; back: () => void }) {
  const [period, setPeriod] = useState<PeriodValue>({
      start: shiftDate(today(), -6),
      end: today(),
    }),
    [type, setType] = useState("Daily Production");
  const cash = (n: number) => money(n, state.settings.currency),
    t = totals(state, period.start, period.end),
    inside = (r: { date: string }) =>
      r.date >= period.start && r.date <= period.end;
  let headers: string[] = [],
    rows: (string | number)[][] = [];
  if (type.includes("Production")) {
    const series = productionSeries(state, period.start, period.end);
    const groups = new Map<
      string,
      { eggs: number; rate: number; days: number }
    >();
    for (const r of series) {
      const date =
        type === "Monthly Production"
          ? r.date.slice(0, 7)
          : type === "Weekly Production"
            ? shiftDate(
                r.date,
                -((new Date(r.date + "T12:00:00").getDay() + 6) % 7),
              )
            : r.date;
      const group = groups.get(date) ?? { eggs: 0, rate: 0, days: 0 };
      group.eggs += r.eggs;
      if (state.daily_production.some((p) => p.date === r.date)) {
        group.rate += r.rate;
        group.days++;
      }
      groups.set(date, group);
    }
    headers = ["Period", "Eggs", "Avg. recorded rate"];
    rows = [...groups].map(([date, g]) => [
      date,
      g.eggs,
      g.days ? `${number(g.rate / g.days)}%` : "No record",
    ]);
  } else if (type === "Cage Performance") {
    headers = ["Cage", "Recorded days", "Eggs", "Avg. rate"];
    rows = rankings(state, period.start, period.end).map((r) => [
      `Cage ${r.cage.cage_number}`,
      r.days,
      r.eggs,
      `${number(r.rate)}%`,
    ]);
  } else if (type === "Feed Consumption") {
    headers = ["Date", "Feed", "Kg", "Cost"];
    rows = state.feed_usage
      .filter(inside)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => [
        r.date,
        state.feed_items.find((f) => f.id === r.feed_id)?.name ?? "",
        number(r.quantity_kg),
        cash(r.total_cost),
      ]);
  } else if (type === "Egg Inventory") {
    headers = ["Size", "Eggs at period end", "Trays"];
    rows = state.egg_inventory.map((s) => {
      const sorted = sum(
          state.egg_sorting.filter(
            (r) => r.size === s.id && r.date <= period.end,
          ),
          (r) => r.quantity,
        ),
        sold = sum(
          state.sale_items.filter(
            (i) =>
              i.size === s.id &&
              state.sales.some(
                (r) => r.id === i.sale_id && r.date <= period.end,
              ),
          ),
          (i) => i.eggs,
        );
      return [s.id, sorted - sold, number(trays(sorted - sold), 2)];
    });
  } else if (type === "Sales") {
    headers = ["Date", "Customer", "Total"];
    rows = state.sales
      .filter(inside)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => [
        r.date,
        state.customers.find((c) => c.id === r.customer_id)?.name ?? "Walk-in",
        cash(r.total),
      ]);
  } else if (type === "Customer Sales") {
    headers = ["Customer", "Sales in period", "Current balance"];
    rows = state.customers.map((c) => [
      c.name,
      cash(
        sum(
          state.sales.filter((s) => s.customer_id === c.id && inside(s)),
          (s) => s.total,
        ),
      ),
      cash(customerBalance(state, c.id)),
    ]);
  } else if (type === "Receivables") {
    headers = ["Customer", "Sale date", "Due at period end"];
    rows = state.sales
      .filter((r) => r.date <= period.end)
      .map(
        (s) =>
          [
            state.customers.find((c) => c.id === s.customer_id)?.name ??
              "Walk-in",
            s.date,
            Math.max(
              0,
              s.total -
                sum(
                  state.payments.filter(
                    (p) => p.sale_id === s.id && p.date <= period.end,
                  ),
                  (p) => p.amount,
                ),
            ),
          ] as [string, string, number],
      )
      .filter((r) => r[2] > 0)
      .map((r) => [r[0], r[1], cash(r[2])]);
  } else if (type === "Expenses") {
    headers = ["Date", "Category", "Description", "Amount"];
    rows = state.expenses
      .filter(inside)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => [e.date, e.category, e.description, cash(e.amount)]);
  } else {
    headers = ["Metric", "Amount"];
    rows = [
      ["Sales revenue", cash(t.revenue)],
      ["Collected cash", cash(t.collected)],
      ["Cash expenses", cash(t.expenses)],
      ["Feed consumed", cash(t.feedCost)],
      ["Net cash", cash(t.netCash)],
      ["Estimated operating profit", cash(t.operatingProfit)],
    ];
  }
  const ranking = rankings(state, period.start, period.end);
  return (
    <>
      <Heading
        title="Farm reports"
        subtitle="A clearer picture, one record at a time."
        back={back}
      />
      <Period value={period} onChange={setPeriod} />
      <label className="field">
        <span>Report</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {reportTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {type.includes("Production") && (
        <Card>
          <h2>Egg production</h2>
          <Chart data={productionSeries(state, period.start, period.end)} />
          <p className="hint">
            Rates use hen counts saved with each record. Unrecorded cages are
            excluded; missing dates show zero eggs.
          </p>
        </Card>
      )}
      {type === "Cage Performance" && (
        <div className="grid2">
          <Card>
            <h3>Best cages</h3>
            {ranking.slice(0, 3).map((r) => (
              <p key={r.cage.id}>
                Cage {r.cage.cage_number} ·{" "}
                <strong className="good">{number(r.rate)}%</strong>
              </p>
            ))}
          </Card>
          <Card>
            <h3>Lowest cages</h3>
            {[...ranking]
              .reverse()
              .slice(0, 3)
              .map((r) => (
                <p key={r.cage.id}>
                  Cage {r.cage.cage_number} · <strong>{number(r.rate)}%</strong>
                </p>
              ))}
          </Card>
        </div>
      )}
      <Card>
        <h2>{type}</h2>
        <p>
          {period.start} to {period.end}
          {type === "Egg Inventory" || type === "Receivables"
            ? " · balance as of end date"
            : ""}
        </p>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No records in this period"
            detail="Try another date range or add your first record."
          />
        )}
      </Card>
    </>
  );
}
