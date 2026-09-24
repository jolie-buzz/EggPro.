import { useState } from "react";
import { ArrowRight, Package, Plus } from "lucide-react";
import type { State, Category } from "../types/models";
import type { InventoryRepository } from "../repositories/inventory";
import {
  Card,
  Heading,
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
  losses,
  number,
  sum,
  trays,
  today,
  money,
} from "../utils/calculations";
import { feedDays } from "../services/analytics";
export function Inventory({
  state,
  go,
}: {
  state: State;
  go: (p: string) => void;
}) {
  return (
    <>
      <Heading
        title="Your inventory"
        subtitle="Know what’s ready. Plan what’s next."
      />
      <Card className="inventory-total">
        <span className="eyebrow">EGGS READY TO SELL</span>
        <h2>
          {number(sum(state.egg_inventory, (r) => r.quantity))}{" "}
          <small>eggs</small>
        </h2>
        <p>
          {number(trays(sum(state.egg_inventory, (r) => r.quantity)), 2)} trays
          · 30 eggs per tray
        </p>
        <button className="primary" onClick={() => go("sorting")}>
          <Plus size={18} /> Sort collection
        </button>
      </Card>
      <div className="grid2">
        {state.egg_inventory.map((r, i) => (
          <Card key={r.id} className={`egg-stock egg-${i}`}>
            <div className="section-title">
              <span className="egg-drawing" />
              <span className="badge">{r.id}</span>
            </div>
            <strong className="big-number">{number(r.quantity)}</strong>
            <p>eggs · {number(trays(r.quantity), 2)} trays</p>
          </Card>
        ))}
      </div>
      <Card>
        <div className="section-title">
          <h2>Feed store</h2>
          <button className="text-button" onClick={() => go("feed")}>
            Manage <ArrowRight size={16} />
          </button>
        </div>
        {state.feed_items.map((f) => (
          <div className="list-row" key={f.id}>
            <div>
              <strong>{f.name}</strong>
              <small>
                {f.quantity_kg <= f.reorder_level_kg
                  ? "Low stock · time to reorder"
                  : "Stock available"}
              </small>
            </div>
            <strong>{number(f.quantity_kg)} kg</strong>
          </div>
        ))}
      </Card>
    </>
  );
}
export function Sorting({
  state,
  repo,
  refresh,
  back,
}: {
  state: State;
  repo: InventoryRepository;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [date, setDate] = useState(today()),
    [saved, setSaved] = useState(""),
    [addingSize, setAddingSize] = useState(false);
  return (
    <>
      <Heading
        title="Sort your collection"
        subtitle="Good eggs go into stock. Losses stay in your records."
        back={back}
      />
      <Field label="Collection date">
        <input
          type="date"
          max={today()}
          value={date}
          onChange={(e) => {
            if (e.target.value) {
              setDate(e.target.value);
              setSaved("");
            }
          }}
        />
      </Field>
      <SortingForm
        key={
          date +
          state.egg_sorting
            .filter((r) => r.date === date)
            .map((r) => r.updated_at)
            .join("")
        }
        state={state}
        date={date}
        addSize={() => setAddingSize(true)}
        save={async (counts) => {
          await repo.sort(date, counts);
          await refresh();
          setSaved("Sorting saved. Inventory updated by the change only.");
        }}
      />
      {addingSize && (
        <Modal title="Add custom size" close={() => setAddingSize(false)}>
          <Form
            label="Add size"
            onSave={async (d) => {
              await repo.addSize(str(d, "sizeName"), num(d, "price"));
              await refresh();
              setAddingSize(false);
              setSaved("Custom size added. Enter its egg count below.");
            }}
          >
            <Field label="Size name">
              <input
                name="sizeName"
                placeholder="e.g. Jumbo or Peewee"
                required
                maxLength={40}
                autoFocus
              />
            </Field>
            <NumberField
              label="Default price per tray · 30 eggs"
              name="price"
              value={0}
              step="0.01"
            />
            <p className="hint">
              This size will be available in sorting, inventory, sales, and
              price settings.
            </p>
          </Form>
        </Modal>
      )}
      {saved && (
        <p className="notice" role="status">
          {saved}
        </p>
      )}
    </>
  );
}
function SortingForm({
  state,
  date,
  save,
  addSize,
}: {
  state: State;
  date: string;
  addSize: () => void;
  save: (counts: Record<Category, number>) => Promise<void>;
}) {
  const categories = [...state.egg_inventory.map((r) => r.id), ...losses];
  const produced = sum(
    state.daily_production.filter((r) => r.date === date),
    (r) => r.egg_count,
  );
  const [counts, setCounts] = useState(
    Object.fromEntries(
      categories.map((c) => [
        c,
        state.egg_sorting.find((r) => r.date === date && r.size === c)
          ?.quantity ?? 0,
      ]),
    ) as Record<Category, number>,
  );
  const sorted = sum(Object.values(counts), (n) => n);
  return (
    <Card>
      <div className="stats three">
        <Stat label="Produced" value={produced} />
        <Stat label="Sorted" value={sorted} />
        <Stat label="Difference" value={produced - sorted} />
      </div>
      <Form
        label="Save sorting & update stock"
        onSave={async () => {
          if (
            sorted !== produced &&
            !confirm(
              `Production: ${produced}. Sorted: ${sorted}. Difference: ${produced - sorted} eggs. Save with this mismatch?`,
            )
          )
            return;
          await save(counts);
        }}
      >
        <div className="section-title">
          <h2>Egg sizes</h2>
          <button type="button" onClick={addSize}>
            <Plus size={18} /> Add custom size
          </button>
        </div>
        <div className="grid2">
          {categories.map((c) => (
            <Field label={c} key={c}>
              <input
                aria-label={`${c} eggs sorted`}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={counts[c] ?? 0}
                onChange={(e) =>
                  setCounts({ ...counts, [c]: Number(e.target.value) })
                }
              />
            </Field>
          ))}
        </div>
        {sorted !== produced && (
          <p className="notice">
            Production: {produced} · Sorted: {sorted} · Difference:{" "}
            {produced - sorted} eggs. You can save after confirming.
          </p>
        )}
        <p className="hint">
          Cracked, damaged, and dirty eggs are recorded as losses and are not
          available for sale.
        </p>
      </Form>
    </Card>
  );
}
export function Feed({
  state,
  repo,
  refresh,
  back,
}: {
  state: State;
  repo: InventoryRepository;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [dialog, setDialog] = useState<"purchase" | "use" | "add" | null>(null),
    [selected, setSelected] = useState(state.feed_items[0]?.id ?? "");
  const feed = state.feed_items.find((f) => f.id === selected);
  const cash = (v: number) => money(v, state.settings.currency);
  return (
    <>
      <Heading
        title="Feed management"
        subtitle="Keep the flock fed and the costs clear."
        back={back}
        action={
          <button onClick={() => setDialog("add")}>
            <Plus size={18} /> Feed type
          </button>
        }
      />
      <div className="actions">
        <button className="primary" onClick={() => setDialog("use")}>
          Record feed used
        </button>
        <button onClick={() => setDialog("purchase")}>Buy feed</button>
      </div>
      {state.feed_items.map((f) => {
        const estimate = feedDays(state, f.id);
        return (
          <Card key={f.id}>
            <div className="section-title">
              <div>
                <h2>{f.name}</h2>
                <p>{f.brand || "Layer feed"}</p>
              </div>
              <Package className="good" />
            </div>
            <div className="stats three">
              <Stat
                label="Remaining"
                value={`${number(f.quantity_kg)} kg`}
                detail={`${number(f.quantity_kg / f.sack_weight_kg, 2)} sacks equivalent`}
              />
              <Stat label="Weighted cost/kg" value={cash(f.average_cost)} />
              <Stat
                label="Estimated days"
                value={estimate ? number(estimate.days) : "—"}
                detail={
                  estimate
                    ? `${number(estimate.average)} kg/day · up to 7 days`
                    : "Record usage to estimate"
                }
              />
            </div>
            {f.quantity_kg <= f.reorder_level_kg && (
              <p className="notice">
                Low stock · reorder at {f.reorder_level_kg} kg
              </p>
            )}
            <details>
              <summary>Reorder settings</summary>
              <Form
                label="Update reorder level"
                onSave={async (d) => {
                  await repo.setReorder(f.id, num(d, "level"));
                  await refresh();
                }}
              >
                <NumberField
                  label="Reorder at (kg)"
                  name="level"
                  value={f.reorder_level_kg}
                  step="0.01"
                />
              </Form>
            </details>
          </Card>
        );
      })}
      <Card>
        <h2>Recent feed use</h2>
        {state.feed_usage.length ? (
          [...state.feed_usage]
            .sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                b.created_at.localeCompare(a.created_at),
            )
            .slice(0, 30)
            .map((u) => (
              <div className="list-row" key={u.id}>
                <div>
                  <strong>
                    {state.feed_items.find((f) => f.id === u.feed_id)?.name}
                  </strong>
                  <small>
                    {u.date}
                    {u.notes ? ` · ${u.notes}` : ""}
                  </small>
                </div>
                <div className="align-right">
                  <strong>{number(u.quantity_kg)} kg</strong>
                  <small>{cash(u.total_cost)}</small>
                </div>
              </div>
            ))
        ) : (
          <Empty
            title="No feed use recorded"
            detail="Log the kilograms you feed each day."
          />
        )}
      </Card>
      <Card>
        <h2>Purchase history</h2>
        {[...state.feed_purchases]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((p) => (
            <div className="list-row" key={p.id}>
              <div>
                <strong>
                  {p.sacks} sacks · {number(p.sacks * p.sack_weight_kg)} kg
                </strong>
                <small>
                  {p.date} · {p.supplier || "No supplier"}
                </small>
              </div>
              <strong>{cash(p.total_cost)}</strong>
            </div>
          ))}
      </Card>
      {dialog && (
        <Modal
          title={
            dialog === "use"
              ? "Record feed used"
              : dialog === "purchase"
                ? "Purchase feed"
                : "Add feed type"
          }
          close={() => setDialog(null)}
        >
          <Form
            label={dialog === "purchase" ? "Save purchase & expense" : "Save"}
            onSave={async (d) => {
              if (dialog === "add")
                await repo.addFeed({
                  name: str(d, "name"),
                  brand: str(d, "brand"),
                  sackWeight: num(d, "weight"),
                  cost: num(d, "cost"),
                  reorder: num(d, "reorder"),
                });
              else if (dialog === "purchase")
                await repo.purchase({
                  feedId: selected,
                  date: str(d, "date"),
                  supplier: str(d, "supplier"),
                  sacks: num(d, "sacks"),
                  weight: num(d, "weight"),
                  cost: num(d, "cost"),
                });
              else
                await repo.use({
                  feedId: selected,
                  date: str(d, "date"),
                  kg: num(d, "kg"),
                  notes: str(d, "notes"),
                });
              await refresh();
              setDialog(null);
            }}
          >
            {dialog === "add" ? (
              <>
                <Field label="Feed name">
                  <input name="name" required />
                </Field>
                <Field label="Brand · optional">
                  <input name="brand" />
                </Field>
                <NumberField
                  label="Sack weight (kg)"
                  name="weight"
                  value={50}
                  min={0.01}
                  step="0.01"
                />
                <NumberField label="Cost per sack" name="cost" step="0.01" />
                <NumberField
                  label="Reorder level (kg)"
                  name="reorder"
                  value={50}
                  step="0.01"
                />
              </>
            ) : (
              <>
                <Field label="Feed type">
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {state.feed_items.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date">
                  <input
                    name="date"
                    type="date"
                    defaultValue={today()}
                    max={today()}
                    required
                  />
                </Field>
                {dialog === "purchase" ? (
                  <div key={selected}>
                    <NumberField
                      label="Number of sacks"
                      name="sacks"
                      value={1}
                      min={0.01}
                      step="0.01"
                    />
                    <NumberField
                      label="Kg per sack"
                      name="weight"
                      value={feed?.sack_weight_kg ?? 50}
                      min={0.01}
                      step="0.01"
                    />
                    <NumberField
                      label="Cost per sack"
                      name="cost"
                      value={(feed?.cost_per_sack ?? 0) / 100}
                      step="0.01"
                    />
                    <Field label="Supplier · optional">
                      <input name="supplier" />
                    </Field>
                    <p className="hint">
                      Adds feed stock and one matching cash expense. Purchases
                      on the same date are applied before consumption.
                    </p>
                  </div>
                ) : (
                  <>
                    <NumberField
                      label="Quantity used (kg)"
                      name="kg"
                      value={0}
                      min={0.01}
                      step="0.01"
                    />
                    <Field label="Notes">
                      <textarea name="notes" />
                    </Field>
                    <p className="hint">
                      This adds a consumption entry; it does not replace an
                      earlier entry.
                    </p>
                  </>
                )}
              </>
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
