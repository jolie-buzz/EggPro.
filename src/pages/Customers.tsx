import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import type { State, Customer, Sale } from "../types/models";
import type { SalesRepository } from "../repositories/sales";
import {
  Card,
  Heading,
  Field,
  Form,
  NumberField,
  Modal,
  Empty,
  Stat,
  str,
  num,
} from "../components/ui";
import { customerBalance, saleBalance } from "../services/analytics";
import { money, sum, cents, today } from "../utils/calculations";
import { SaleDetail } from "./Sales";
export function Customers({
  state,
  repo,
  refresh,
  back,
}: {
  state: State;
  repo: SalesRepository;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Customer | null | undefined>(),
    [profile, setProfile] = useState<string | null>(null),
    [sort, setSort] = useState("name");
  const customer = state.customers.find((c) => c.id === profile),
    cash = (v: number) => money(v, state.settings.currency);
  const sales = state.sales
    .filter((s) => s.customer_id === profile)
    .sort((a, b) => b.date.localeCompare(a.date));
  const preferred = state.egg_inventory
    .map((r) => r.id)
    .map((size) => ({
      size,
      eggs: sum(
        state.sale_items.filter(
          (i) => i.size === size && sales.some((s) => s.id === i.sale_id),
        ),
        (i) => i.eggs,
      ),
    }))
    .sort((a, b) => b.eggs - a.eggs)[0];
  return (
    <>
      <Heading
        title={customer ? customer.name : "Customers"}
        subtitle={
          customer
            ? "Your relationship, in one place."
            : "Keep every customer and balance close."
        }
        back={customer ? () => setProfile(null) : back}
        action={
          <button
            className="primary"
            onClick={() => setEditing(customer ?? null)}
          >
            {customer ? <Pencil size={18} /> : <Plus size={18} />}{" "}
            {customer ? "Edit" : "Add"}
          </button>
        }
      />
      {customer ? (
        <>
          <Card>
            <p>
              {customer.phone} {customer.address}
            </p>
            {customer.notes && <p>{customer.notes}</p>}
            <div className="stats">
              <Stat
                label="Total purchases"
                value={cash(sum(sales, (s) => s.total))}
              />
              <Stat
                label="Outstanding"
                value={cash(customerBalance(state, customer.id))}
              />
              <Stat label="Last purchase" value={sales[0]?.date ?? "—"} />
              <Stat
                label="Favorite size"
                value={preferred.eggs ? preferred.size : "—"}
              />
            </div>
          </Card>
          <h2>Transaction & payment history</h2>
          {sales.length ? (
            sales.map((s) => (
              <Card key={s.id}>
                <h3>Sale #{s.id.slice(0, 8)}</h3>
                <SaleDetail state={state} sale={s} />
              </Card>
            ))
          ) : (
            <Card>
              <Empty title="No transactions yet" />
            </Card>
          )}
        </>
      ) : (
        <>
          <div className="toolbar">
            <input
              aria-label="Search customers"
              placeholder="Search name, phone or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Sort customers"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="balance">Balance</option>
            </select>
          </div>
          <Card>
            {state.customers.length ? (
              state.customers
                .filter((c) =>
                  `${c.name} ${c.phone} ${c.address}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .sort((a, b) =>
                  sort === "balance"
                    ? customerBalance(state, b.id) -
                      customerBalance(state, a.id)
                    : a.name.localeCompare(b.name),
                )
                .map((c) => (
                  <button
                    className="list-row row-button"
                    key={c.id}
                    onClick={() => setProfile(c.id)}
                  >
                    <div>
                      <strong>{c.name}</strong>
                      <small>{c.phone || "View customer profile"}</small>
                    </div>
                    <strong>{cash(customerBalance(state, c.id))}</strong>
                  </button>
                ))
            ) : (
              <Empty
                title="Meet your first customer"
                detail="Add a customer to track purchases and credit."
              />
            )}
          </Card>
        </>
      )}
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit customer" : "New customer"}
          close={() => setEditing(undefined)}
        >
          <Form
            onSave={async (d) => {
              await repo.customer(
                {
                  name: str(d, "name"),
                  phone: str(d, "phone"),
                  address: str(d, "address"),
                  notes: str(d, "notes"),
                },
                editing?.id,
              );
              await refresh();
              setEditing(undefined);
            }}
          >
            <Field label="Name">
              <input name="name" defaultValue={editing?.name} required />
            </Field>
            <Field label="Phone · optional">
              <input name="phone" type="tel" defaultValue={editing?.phone} />
            </Field>
            <Field label="Address · optional">
              <input name="address" defaultValue={editing?.address} />
            </Field>
            <Field label="Notes">
              <textarea name="notes" defaultValue={editing?.notes} />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function Receivables({
  state,
  repo,
  refresh,
  back,
}: {
  state: State;
  repo: SalesRepository;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [paying, setPaying] = useState<Sale | null>(null),
    [query, setQuery] = useState("");
  const cash = (v: number) => money(v, state.settings.currency);
  const customers = state.customers
    .filter(
      (c) =>
        customerBalance(state, c.id) > 0 &&
        c.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort(
      (a, b) => customerBalance(state, b.id) - customerBalance(state, a.id),
    );
  return (
    <>
      <Heading
        title="Receivables"
        subtitle="A clear view of what’s still to collect."
        back={back}
      />
      <input
        aria-label="Search receivables"
        placeholder="Search customer…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {customers.length ? (
        customers.map((c) => {
          const sales = state.sales
            .filter(
              (s) => s.customer_id === c.id && saleBalance(state, s.id) > 0,
            )
            .sort((a, b) => a.date.localeCompare(b.date));
          const last = state.payments
            .filter((p) =>
              state.sales.some(
                (s) => s.id === p.sale_id && s.customer_id === c.id,
              ),
            )
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          const age = Math.round(
            (Date.parse(today()) - Date.parse(sales[0].date)) / 86400000,
          );
          return (
            <Card key={c.id}>
              <div className="section-title">
                <h2>{c.name}</h2>
                <strong>{cash(customerBalance(state, c.id))}</strong>
              </div>
              <p>
                Oldest balance: {age} days · Last payment:{" "}
                {last?.date ?? "None yet"}
              </p>
              {sales.map((s) => (
                <div className="list-row" key={s.id}>
                  <div>
                    <strong>{cash(saleBalance(state, s.id))} due</strong>
                    <small>
                      {s.date} · #{s.id.slice(0, 8)}
                    </small>
                  </div>
                  <button onClick={() => setPaying(s)}>Record payment</button>
                </div>
              ))}
            </Card>
          );
        })
      ) : (
        <Card>
          <Empty
            title="No outstanding balances"
            detail="Credit and partially paid sales appear here."
          />
        </Card>
      )}
      {paying && (
        <Modal title="Record payment" close={() => setPaying(null)}>
          <p>Outstanding: {cash(saleBalance(state, paying.id))}</p>
          <Form
            label="Save payment"
            onSave={async (d) => {
              await repo.pay({
                saleId: paying.id,
                date: str(d, "date"),
                amount: cents(num(d, "amount")),
                method: str(d, "method"),
                notes: str(d, "notes"),
              });
              await refresh();
              setPaying(null);
            }}
          >
            <Field label="Payment date">
              <input
                name="date"
                type="date"
                min={paying.date}
                max={today()}
                defaultValue={today()}
                required
              />
            </Field>
            <NumberField
              label="Amount · change for a partial payment"
              name="amount"
              min={0.01}
              value={saleBalance(state, paying.id) / 100}
              step="0.01"
            />
            <Field label="Method">
              <select name="method">
                <option>Cash</option>
                <option>GCash</option>
                <option>Bank Transfer</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea name="notes" />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
