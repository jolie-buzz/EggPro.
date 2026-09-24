import { useState, useRef, useEffect } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { State, Cage, Production as Record } from "../types/models";
import type { ProductionRepository } from "../repositories/production";
import { Heading, Card, Stat, errorMessage, Empty } from "../components/ui";
import { number, rate, status, sum, today } from "../utils/calculations";
function Entry({
  cage,
  record,
  date,
  repo,
  refresh,
}: {
  cage: Cage;
  record?: Record;
  date: string;
  repo: ProductionRepository;
  refresh: () => Promise<void>;
}) {
  const [value, setValue] = useState(String(record?.egg_count ?? 0)),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const latest = useRef(0),
    current = useRef(record?.egg_count ?? 0),
    saved = useRef(record?.egg_count ?? 0);
  const hens = record?.hen_count_snapshot ?? cage.hen_count;
  useEffect(() => {
    if (!pending) {
      saved.current = record?.egg_count ?? 0;
      current.current = saved.current;
      setValue(String(saved.current));
    }
  }, [record?.egg_count]);
  async function save(n: number) {
    current.current = n;
    setValue(String(n));
    const request = ++latest.current;
    setPending(true);
    setError("");
    try {
      await repo.save(date, cage.id, n, record?.notes ?? "");
      saved.current = n;
      await refresh();
    } catch (e) {
      if (request === latest.current) {
        setError(errorMessage(e));
        current.current = saved.current;
        setValue(String(saved.current));
      }
    } finally {
      if (request === latest.current) setPending(false);
    }
  }
  return (
    <div
      className={`production-row ${status(record ? rate(record.egg_count, hens) : null)}`}
    >
      <div className="cage-label">
        <strong>Cage {cage.cage_number}</strong>
        <small>
          {hens} hens{cage.status === "inactive" ? " · inactive" : ""} ·{" "}
          {pending
            ? "Saving…"
            : record
              ? `${number(rate(record.egg_count, hens))}%`
              : "No record"}
        </small>
        {error && (
          <small className="error" role="alert">
            {error}
          </small>
        )}
      </div>
      <div className="stepper">
        <button
          aria-label={`Subtract egg Cage ${cage.cage_number}`}
          disabled={current.current <= 0}
          onClick={() => save(Math.max(0, current.current - 1))}
        >
          <Minus size={20} />
        </button>
        <input
          aria-label={`Eggs Cage ${cage.cage_number}`}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            setValue(raw);
            if (
              raw !== "" &&
              Number.isSafeInteger(Number(raw)) &&
              Number(raw) >= 0
            )
              void save(Number(raw));
          }}
          onBlur={() => {
            if (
              value === "" ||
              !Number.isSafeInteger(Number(value)) ||
              Number(value) < 0
            ) {
              setValue(String(saved.current));
              setError("Enter a whole number of eggs, zero or more.");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <button
          aria-label={`Add egg Cage ${cage.cage_number}`}
          onClick={() => save(current.current + 1)}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
export function Production({
  state,
  repo,
  refresh,
}: {
  state: State;
  repo: ProductionRepository;
  refresh: () => Promise<void>;
}) {
  const [date, setDate] = useState(today()),
    [q, setQ] = useState(""),
    [sort, setSort] = useState("cage"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = state.daily_production.filter((r) => r.date === date);
  const lookup = new Map(rows.map((r) => [r.cage_id, r]));
  const cages = state.cages
    .filter(
      (c) =>
        (c.status === "active" || lookup.has(c.id)) &&
        `${c.cage_number} ${c.name}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "cage"
        ? a.cage_number.localeCompare(b.cage_number, undefined, {
            numeric: true,
          })
        : sort === "eggs"
          ? (lookup.get(b.id)?.egg_count ?? -1) -
            (lookup.get(a.id)?.egg_count ?? -1)
          : rate(
              lookup.get(b.id)?.egg_count ?? 0,
              lookup.get(b.id)?.hen_count_snapshot ?? b.hen_count,
            ) -
            rate(
              lookup.get(a.id)?.egg_count ?? 0,
              lookup.get(a.id)?.hen_count_snapshot ?? a.hen_count,
            ),
    );
  const eggs = sum(rows, (r) => r.egg_count),
    hens = sum(
      state.cages.filter((c) => c.status === "active"),
      (c) => c.hen_count,
    );
  const denominator =
    date === today() ? hens : sum(rows, (r) => r.hen_count_snapshot);
  async function bulk(mode: "zero" | "yesterday" | "clear") {
    if (
      !confirm(
        `${mode === "clear" ? "Clear all records for" : mode === "zero" ? "Set all active cages to zero on" : "Replace active cage entries with yesterday’s records for"} ${date}? Egg sorting and stock are not changed.`,
      )
    )
      return;
    setBusy(true);
    try {
      await repo.bulk(date, mode);
      await refresh();
      setMessage("Day updated and saved.");
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Daily production"
        subtitle="A little care. A good collection."
      />
      <div className="toolbar">
        <input
          aria-label="Production date"
          type="date"
          max={today()}
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
        <span className="saved">
          <Check size={15} /> Entries autosave
        </span>
      </div>
      <div className="stats three">
        <Stat label="Eggs collected" value={eggs} />
        <Stat
          label={date === today() ? "Active hens" : "Recorded hens"}
          value={denominator}
        />
        <Stat
          label="Production"
          value={`${number(rate(eggs, denominator))}%`}
        />
      </div>
      <div className="toolbar">
        <input
          aria-label="Search production cages"
          placeholder="Find a cage…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Sort production"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="cage">Cage number</option>
          <option value="eggs">Egg count</option>
          <option value="rate">Production rate</option>
        </select>
      </div>
      <div className="legend">
        <span className="good">● ≥75%</span>
        <span className="watch">● 50–74%</span>
        <span className="low">● &lt;50%</span>
        <span>● Unrecorded</span>
      </div>
      <Card className="production-list">
        {cages.length ? (
          cages.map((c) => (
            <Entry
              key={`${date}-${c.id}`}
              cage={c}
              record={lookup.get(c.id)}
              date={date}
              repo={repo}
              refresh={refresh}
            />
          ))
        ) : (
          <Empty title="No cages to show" />
        )}
      </Card>
      <div className="sticky-summary">
        <strong>
          {eggs} eggs <small>· {rows.length} cages recorded</small>
        </strong>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            await refresh();
            setMessage(
              "Entries are saved after each change. Unrecorded cages remain blank.",
            );
          }}
        >
          Save day <Check size={18} />
        </button>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <details className="card">
        <summary>Day actions</summary>
        <div className="actions">
          <button disabled={busy} onClick={() => bulk("zero")}>
            Set all zero
          </button>
          <button disabled={busy} onClick={() => bulk("yesterday")}>
            Copy yesterday
          </button>
          <button
            disabled={busy}
            className="danger"
            onClick={() => bulk("clear")}
          >
            Clear entries
          </button>
        </div>
      </details>
    </>
  );
}
