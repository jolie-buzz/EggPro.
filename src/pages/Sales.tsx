import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Heading,
  Card,
  Field,
  Form,
  NumberField,
  Modal,
  Empty,
  num,
  str,
} from "../components/ui";
import type { State, Size, Sale } from "../types/models";
import type { SalesRepository, SaleDraft } from "../repositories/sales";
import { money, today, cents, number, methods } from "../utils/calculations";
import { saleBalance } from "../services/analytics";
export function Sales({
  state,
  repo,
  refresh,
  go,
}: {
  state: State;
  repo: SalesRepository;
  refresh: () => Promise<void>;
  go: (p: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [detail, setDetail] = useState<Sale | null>(null),
    [sort, setSort] = useState("date");
  const cash = (n: number) => money(n, state.settings.currency);
  const rows = state.sales
    .filter((s) =>
      `${s.id} ${s.date} ${state.customers.find((c) => c.id === s.customer_id)?.name ?? "Walk-in"}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "date"
        ? b.date.localeCompare(a.date) ||
          b.created_at.localeCompare(a.created_at)
        : saleBalance(state, b.id) - saleBalance(state, a.id),
    );
  return (
    <>
      <Heading
        title="Sales"
        subtitle="From your farm to their table."
        action={
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus size={18} /> New sale
          </button>
        }
      />
      <div className="actions">
        <button onClick={() => go("customers")}>Customers</button>
        <button onClick={() => go("receivables")}>Receivables</button>
      </div>
      <div className="toolbar">
        <input
          aria-label="Search sales"
          placeholder="Search customer, date or sale ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Sort sales"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date">Newest</option>
          <option value="balance">Highest balance</option>
        </select>
      </div>
      <Card>
        {rows.length ? (
          rows.map((s) => (
            <button
              className="list-row row-button"
              key={s.id}
              onClick={() => setDetail(s)}
            >
              <div>
                <strong>
                  {state.customers.find((c) => c.id === s.customer_id)?.name ??
                    "Walk-in customer"}
                </strong>
                <small>
                  {s.date} · #{s.id.slice(0, 8)}
                </small>
              </div>
              <div className="align-right">
                <strong>{cash(s.total)}</strong>
                <small
                  className={saleBalance(state, s.id) > 0 ? "watch" : "good"}
                >
                  {saleBalance(state, s.id) > 0
                    ? `${cash(saleBalance(state, s.id))} due`
                    : "Paid in full"}
                </small>
              </div>
            </button>
          ))
        ) : (
          <Empty
            title="No sales yet"
            detail="Add eggs to your inventory, then record your first sale."
          />
        )}
      </Card>
      {open && (
        <Modal title="New sale" close={() => setOpen(false)}>
          <SaleForm
            state={state}
            save={async (input) => {
              await repo.save(input);
              await refresh();
              setOpen(false);
            }}
          />
        </Modal>
      )}
      {detail && (
        <Modal
          title={`Sale #${detail.id.slice(0, 8)}`}
          close={() => setDetail(null)}
        >
          <SaleDetail sale={detail} state={state} />
        </Modal>
      )}
    </>
  );
}
function SaleForm({
  state,
  save,
}: {
  state: State;
  save: (s: SaleDraft) => Promise<void>;
}) {
  const prices = JSON.parse(state.settings.prices) as Record<Size, number>;
  const [items, setItems] = useState<SaleDraft["items"]>([
      { size: "Medium", quantity: 1, unit: "Tray", price: prices.Medium },
    ]),
    [discount, setDiscount] = useState(0),
    [paid, setPaid] = useState(0),
    [method, setMethod] = useState("Cash");
  const cash = (n: number) => money(n, state.settings.currency),
    subtotal = items.reduce((n, i) => n + Math.round(i.quantity * i.price), 0),
    total = subtotal - cents(discount);
  function update(i: number, patch: Partial<SaleDraft["items"][number]>) {
    setItems(items.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }
  return (
    <Form
      label="Save sale & update stock"
      onSave={async (d) =>
        save({
          date: str(d, "date"),
          customerId: str(d, "customer") || null,
          items,
          discount: cents(discount),
          paid: cents(paid),
          method,
          notes: str(d, "notes"),
        })
      }
    >
      <Field label="Sale date">
        <input
          type="date"
          name="date"
          defaultValue={today()}
          max={today()}
          required
        />
      </Field>
      <Field label="Customer">
        <select name="customer">
          <option value="">Walk-in · full payment required</option>
          {state.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {items.map((item, i) => (
        <div className="sale-item" key={i}>
          <div className="section-title">
            <h3>Item {i + 1}</h3>
            {items.length > 1 && (
              <button
                className="icon danger"
                type="button"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => setItems(items.filter((_, n) => n !== i))}
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
          <div className="grid2">
            <Field label="Egg size">
              <select
                value={item.size}
                onChange={(e) => {
                  const size = e.target.value as Size;
                  update(i, {
                    size,
                    price: Math.round(
                      prices[size] / (item.unit === "Egg" ? 30 : 1),
                    ),
                  });
                }}
              >
                {state.egg_inventory
                  .map((r) => r.id)
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </Field>
            <Field label="Unit">
              <select
                value={item.unit}
                onChange={(e) => {
                  const unit = e.target.value as "Egg" | "Tray";
                  update(i, {
                    unit,
                    price: Math.round(
                      prices[item.size] / (unit === "Egg" ? 30 : 1),
                    ),
                  });
                }}
              >
                <option>Tray</option>
                <option>Egg</option>
              </select>
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                value={item.quantity}
                onChange={(e) =>
                  update(i, { quantity: Number(e.target.value) })
                }
                required
              />
            </Field>
            <Field label={`Price per ${item.unit.toLowerCase()}`}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={item.price / 100}
                onChange={(e) =>
                  update(i, { price: cents(Number(e.target.value)) })
                }
                required
              />
            </Field>
          </div>
          <p className="hint">
            {state.egg_inventory.find((r) => r.id === item.size)?.quantity ?? 0}{" "}
            eggs available ·{" "}
            {number(item.quantity * (item.unit === "Tray" ? 30 : 1))} eggs
            requested
          </p>
        </div>
      ))}
      <button
        type="button"
        className="full"
        onClick={() =>
          setItems([
            ...items,
            { size: "Medium", quantity: 1, unit: "Tray", price: prices.Medium },
          ])
        }
      >
        <Plus size={17} /> Add item
      </button>
      <div className="grid2">
        <Field label="Discount">
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </Field>
        <Field label="Payment method">
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              if (e.target.value === "Credit / Utang") setPaid(0);
            }}
          >
            {methods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="list-row">
        <span>Subtotal</span>
        <strong>{cash(subtotal)}</strong>
      </div>
      <div className="list-row">
        <strong>Total</strong>
        <strong>{cash(total)}</strong>
      </div>
      <Field label="Amount paid">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max={Math.max(0, total / 100)}
          step="0.01"
          value={paid}
          disabled={method === "Credit / Utang"}
          onChange={(e) => setPaid(Number(e.target.value))}
        />
      </Field>
      <button
        type="button"
        onClick={() => {
          setMethod("Cash");
          setPaid(Math.max(0, total / 100));
        }}
      >
        Mark paid in full
      </button>
      <p className="notice">
        Balance: {cash(Math.max(0, total - cents(paid)))}
      </p>
      <Field label="Notes · optional">
        <textarea name="notes" />
      </Field>
    </Form>
  );
}
export function SaleDetail({ state, sale }: { state: State; sale: Sale }) {
  const cash = (n: number) => money(n, state.settings.currency);
  return (
    <>
      <p>
        {state.customers.find((c) => c.id === sale.customer_id)?.name ??
          "Walk-in customer"}{" "}
        · {sale.date}
      </p>
      {state.sale_items
        .filter((i) => i.sale_id === sale.id)
        .map((i) => (
          <div className="list-row" key={i.id}>
            <div>
              <strong>
                {i.size} · {number(i.quantity)} {i.unit.toLowerCase()}s
              </strong>
              <small>
                {cash(i.price_snapshot)} each · {i.eggs} eggs
              </small>
            </div>
            <strong>{cash(i.total)}</strong>
          </div>
        ))}
      <div className="list-row">
        <span>Discount</span>
        <span>{cash(sale.discount)}</span>
      </div>
      <div className="list-row">
        <strong>Total</strong>
        <strong>{cash(sale.total)}</strong>
      </div>
      <div className="list-row">
        <strong>Outstanding</strong>
        <strong>{cash(saleBalance(state, sale.id))}</strong>
      </div>
      {sale.notes && <p>{sale.notes}</p>}
      <h3>Payment history</h3>
      {state.payments
        .filter((p) => p.sale_id === sale.id)
        .map((p) => (
          <div className="list-row" key={p.id}>
            <div>
              <strong>{p.method}</strong>
              <small>
                {p.date} · {p.notes}
              </small>
            </div>
            <span>{cash(p.amount)}</span>
          </div>
        ))}
    </>
  );
}
