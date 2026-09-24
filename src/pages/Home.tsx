import { ArrowUpRight, ArrowRight, Egg, Plus } from "lucide-react";
import type { State } from "../types/models";
import { Card, Heading, Stat, Empty } from "../components/ui";
import { Chart } from "../components/Chart";
import { totals, rankings, productionSeries } from "../services/analytics";
import {
  money,
  number,
  rate,
  shiftDate,
  sum,
  today,
} from "../utils/calculations";
export function Home({
  state,
  go,
}: {
  state: State;
  go: (page: string) => void;
}) {
  const date = today(),
    t = totals(state, date),
    hens = sum(
      state.cages.filter((c) => c.status === "active"),
      (c) => c.hen_count,
    ),
    ranks = rankings(state, date, date);
  const cash = (v: number) => money(v, state.settings.currency);
  return (
    <>
      <Heading
        title="Your farm, at a glance"
        subtitle={new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      />
      <section className="hero">
        <div>
          <span className="eyebrow">TODAY’S COLLECTION</span>
          <h2>
            {number(t.eggs)} <span>eggs</span>
          </h2>
          <p>
            <span className="hero-pill">
              {number(rate(t.eggs, hens))}% production
            </span>{" "}
            {state.daily_production.filter((r) => r.date === date).length} cages
            recorded
          </p>
        </div>
        <Egg className="hero-egg" size={90} strokeWidth={1} />
        <button onClick={() => go("production")}>
          Record eggs <ArrowUpRight size={20} />
        </button>
      </section>
      <div className="stats">
        <Stat label="Total hens" value={hens} />
        <Stat
          label="Active cages"
          value={state.cages.filter((c) => c.status === "active").length}
        />
        <Stat label="Feed used today" value={`${number(t.feedKg)} kg`} />
        <Stat
          label="Feed remaining"
          value={`${number(sum(state.feed_items, (f) => f.quantity_kg))} kg`}
        />
        <Stat label="Sales today" value={cash(t.revenue)} />
        <Stat label="Expenses today" value={cash(t.expenses)} />
        <Stat label="Net cash today" value={cash(t.netCash)} />
        <Stat label="Receivables" value={cash(t.receivables)} />
      </div>
      <div className="actions">
        <button onClick={() => go("sorting")}>
          <Egg size={18} /> Sort eggs
        </button>
        <button onClick={() => go("feed")}>
          <Plus size={18} /> Record feed
        </button>
        <button onClick={() => go("sales")}>
          <Plus size={18} /> New sale
        </button>
      </div>
      <Card>
        <div className="section-title">
          <div>
            <h2>A week of progress</h2>
            <p>Eggs collected · last 7 days</p>
          </div>
          <button className="text-button" onClick={() => go("reports")}>
            Reports <ArrowRight size={16} />
          </button>
        </div>
        <Chart data={productionSeries(state, shiftDate(date, -6), date)} />
      </Card>
      <div className="grid2">
        <Card>
          <h2>Best performing</h2>
          {ranks.length ? (
            ranks.slice(0, 3).map((r) => (
              <div className="list-row" key={r.cage.id}>
                <span>Cage {r.cage.cage_number}</span>
                <strong className="good">{number(r.rate)}%</strong>
              </div>
            ))
          ) : (
            <Empty
              title="Ready for your first collection"
              detail="Enter today’s cage production to see performance."
              action={
                <button onClick={() => go("production")}>
                  Enter production
                </button>
              }
            />
          )}
        </Card>
        <Card>
          <h2>Lowest performing</h2>
          {ranks.length ? (
            [...ranks]
              .reverse()
              .slice(0, 3)
              .map((r) => (
                <div className="list-row" key={r.cage.id}>
                  <span>Cage {r.cage.cage_number}</span>
                  <strong>{number(r.rate)}%</strong>
                </div>
              ))
          ) : (
            <p>Rankings appear as you record eggs.</p>
          )}
        </Card>
      </div>
      <Card>
        <h2>Farm alerts</h2>
        {state.alerts.map((a) => (
          <p className="notice" key={a.id}>
            {a.message}
          </p>
        ))}
        {state.feed_items
          .filter((f) => f.quantity_kg <= f.reorder_level_kg)
          .map((f) => (
            <p className="notice" key={f.id}>
              {f.name}: {number(f.quantity_kg)} kg remaining. Reorder level:{" "}
              {number(f.reorder_level_kg)} kg.
            </p>
          ))}
        {!state.alerts.length &&
          !state.feed_items.some(
            (f) => f.quantity_kg <= f.reorder_level_kg,
          ) && <p>Everything looks steady. No current alerts.</p>}
      </Card>
      <Card>
        <div className="section-title">
          <h2>Recent sales</h2>
          <button className="text-button" onClick={() => go("sales")}>
            View all <ArrowRight size={16} />
          </button>
        </div>
        {state.sales.length ? (
          [...state.sales]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 4)
            .map((s) => (
              <div className="list-row" key={s.id}>
                <div>
                  <strong>
                    {state.customers.find((c) => c.id === s.customer_id)
                      ?.name ?? "Walk-in customer"}
                  </strong>
                  <small>{s.date}</small>
                </div>
                <strong>{cash(s.total)}</strong>
              </div>
            ))
        ) : (
          <Empty
            title="Your first sale starts here"
            detail="Sort your eggs into stock, then record a sale."
          />
        )}
      </Card>
    </>
  );
}
