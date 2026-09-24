import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import type { State, Expense } from "../types/models";
import type { ExpenseRepository } from "../repositories/expenses";
import {
  Heading,
  Card,
  Stat,
  Field,
  Form,
  NumberField,
  Modal,
  Empty,
  str,
  num,
} from "../components/ui";
import {
  expenseCategories,
  today,
  money,
  sum,
  cents,
} from "../utils/calculations";
export function Expenses({
  state,
  repo,
  refresh,
  back,
  go,
}: {
  state: State;
  repo: ExpenseRepository;
  refresh: () => Promise<void>;
  back: () => void;
  go: (p: string) => void;
}) {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("All"),
    [editing, setEditing] = useState<Expense | null | undefined>();
  const cash = (n: number) => money(n, state.settings.currency);
  const rows = state.expenses
    .filter(
      (e) =>
        (category === "All" || e.category === category) &&
        `${e.date} ${e.description} ${e.supplier}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.created_at.localeCompare(a.created_at),
    );
  return (
    <>
      <Heading
        title="Expenses"
        subtitle="Every cost accounted for."
        back={back}
        action={
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={18} /> Add expense
          </button>
        }
      />
      <div className="stats two">
        <Stat
          label="Today"
          value={cash(
            sum(
              state.expenses.filter((e) => e.date === today()),
              (e) => e.amount,
            ),
          )}
        />
        <Stat
          label="This month"
          value={cash(
            sum(
              state.expenses.filter(
                (e) => e.date.slice(0, 7) === today().slice(0, 7),
              ),
              (e) => e.amount,
            ),
          )}
        />
      </div>
      <div className="toolbar">
        <input
          aria-label="Search expenses"
          placeholder="Search expenses…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Expense category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["All", ...expenseCategories].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <Card>
        {rows.length ? (
          rows.map((e) => (
            <div className="list-row" key={e.id}>
              <div>
                <strong>{e.description}</strong>
                <small>
                  {e.date} · {e.category}
                  {e.supplier ? ` · ${e.supplier}` : ""}
                </small>
                {e.notes && <small>{e.notes}</small>}
              </div>
              <div className="row-end">
                <strong>{cash(e.amount)}</strong>
                {!e.feed_purchase_id && (
                  <button
                    className="icon"
                    aria-label={`Edit ${e.description}`}
                    onClick={() => setEditing(e)}
                  >
                    <Pencil size={17} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="No expenses to show"
            detail="Feed purchases automatically appear here too."
          />
        )}
      </Card>
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit expense" : "New expense"}
          close={() => setEditing(undefined)}
        >
          <Form
            onSave={async (d) => {
              await repo.save(
                {
                  date: str(d, "date"),
                  category: str(d, "category"),
                  description: str(d, "description"),
                  amount: cents(num(d, "amount")),
                  supplier: str(d, "supplier"),
                  notes: str(d, "notes"),
                },
                editing?.id,
              );
              await refresh();
              setEditing(undefined);
            }}
          >
            <Field label="Date">
              <input
                name="date"
                type="date"
                max={today()}
                defaultValue={editing?.date ?? today()}
                required
              />
            </Field>
            <Field label="Category">
              <select
                name="category"
                defaultValue={editing?.category ?? "Others"}
              >
                {expenseCategories
                  .filter((c) => c !== "Feed")
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </Field>
            <p className="hint">
              Buying feed?{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => go("feed")}
              >
                Use Feed management
              </button>{" "}
              to update stock too.
            </p>
            <Field label="Description">
              <input
                name="description"
                defaultValue={editing?.description}
                required
              />
            </Field>
            <NumberField
              label="Amount"
              name="amount"
              value={(editing?.amount ?? 0) / 100}
              step="0.01"
            />
            <Field label="Supplier · optional">
              <input name="supplier" defaultValue={editing?.supplier} />
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
