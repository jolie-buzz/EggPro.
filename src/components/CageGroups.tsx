import { useState } from "react";
import type { State } from "../types/models";
import type { FarmRepository } from "../repositories/farm";
import { parseCageGroups, type CageGroup } from "../services/cage-groups";
import { productivity } from "../services/productivity";
import { number } from "../utils/calculations";
import type { PeriodValue } from "./Period";
import { Card, Field, Form, Modal, str, errorMessage } from "./ui";
import { ProductivityBadge } from "./ProductivityBadge";
import { Chart } from "./Chart";

export function CageGroups({
  state,
  period,
  farm,
  refresh,
  select,
}: {
  state: State;
  period: PeriodValue;
  farm: FarmRepository;
  refresh: () => Promise<void>;
  select: (ids: string[]) => void;
}) {
  const groups = parseCageGroups(
    state.settings.cage_groups,
    state.cages.map((c) => c.id),
  );
  const [editing, setEditing] = useState<CageGroup | null | undefined>();
  const [members, setMembers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function open(group: CageGroup | null) {
    setEditing(group);
    setMembers(group?.cageIds ?? []);
    setSearch("");
    setError("");
  }
  const comparisons = groups
    .map((group) => ({
      group,
      report: productivity(state, period.start, period.end, group.cageIds),
    }))
    .sort(
      (a, b) =>
        (a.report.rate ?? Infinity) - (b.report.rate ?? Infinity) ||
        a.group.name.localeCompare(b.group.name, undefined, { numeric: true }),
    );
  const cages = [...state.cages].sort((a, b) =>
    a.cage_number.localeCompare(b.cage_number, undefined, { numeric: true }),
  );
  return (
    <Card>
      <div className="section-title">
        <h2>Saved cage groups</h2>
        <button onClick={() => open(null)}>Create group</button>
      </div>
      <p>Save batches such as Group 1 – Older hens or Group 2 – Newly added.</p>
      {groups.length > 0 && (
        <>
          <h3>Compare groups · lowest productivity first</h3>
          <p className="hint">
            {period.start} to {period.end}. Rates use recorded days only.
            Consider age and missing entries when comparing. Current group
            members are used for the whole period; overlapping groups share
            records.
          </p>
          <div className="group-comparison">
            {comparisons.map(({ group, report }) => (
              <section
                className="group-card"
                key={group.id}
                aria-label={`Group ${group.name}`}
              >
                <h3>{group.name}</h3>
                {group.notes && <p>{group.notes}</p>}
                <ProductivityBadge value={report.rate} />
                <p>
                  {number(report.eggs)} eggs · {report.cages.length} cages
                </p>
                <p className="hint">
                  {report.recordedCages}/{report.cages.length} cages recorded ·{" "}
                  {report.cages.reduce((n, c) => n + c.days, 0)}/
                  {report.cages.length * report.days} cage-day entries
                </p>
                <Chart
                  data={report.series.map((d) => ({
                    date: d.date,
                    eggs: d.rate,
                  }))}
                  unit="%"
                  label={`${group.name} daily productivity`}
                />
                <div className="selection-actions">
                  <button
                    onClick={() => select(group.cageIds)}
                    aria-label={`View cages in ${group.name}`}
                  >
                    View cages
                  </button>
                  <button
                    onClick={() => open(group)}
                    aria-label={`Edit ${group.name}`}
                  >
                    Edit group
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit cage group" : "Create cage group"}
          close={() => setEditing(undefined)}
        >
          <Form
            label="Save group"
            onSave={async (data) => {
              await farm.saveGroup(
                {
                  name: str(data, "name"),
                  notes: str(data, "notes"),
                  cageIds: members,
                },
                editing?.id,
              );
              await refresh();
              setEditing(undefined);
            }}
          >
            <Field label="Group name">
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={editing?.name ?? ""}
                placeholder="Group 1 – Older hens"
              />
            </Field>
            <Field label="Age / batch notes">
              <textarea
                name="notes"
                maxLength={500}
                defaultValue={editing?.notes ?? ""}
                placeholder="Example: 18 months old, or added September 2026"
              />
            </Field>
            <Field label="Search group cages">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                // Enter filters; it must not submit (save) the group form.
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
            </Field>
            <p>{members.length} cages selected</p>
            <div className="selection-actions">
              <button
                type="button"
                onClick={() => setMembers(cages.map((c) => c.id))}
              >
                Select all
              </button>
              <button type="button" onClick={() => setMembers([])}>
                Clear
              </button>
            </div>
            <div
              className="cage-options"
              role="group"
              aria-label="Group members"
            >
              {cages
                .filter((c) =>
                  `${c.cage_number} ${c.name}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((c) => (
                  <label className="cage-option" key={c.id}>
                    <input
                      type="checkbox"
                      checked={members.includes(c.id)}
                      onChange={(e) =>
                        setMembers(
                          e.target.checked
                            ? [...members, c.id]
                            : members.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <span>
                      Cage {c.cage_number}
                      {c.name ? ` · ${c.name}` : ""}
                      {c.status === "inactive" ? " · inactive" : ""}
                    </span>
                  </label>
                ))}
            </div>
          </Form>
          {editing && (
            <button
              className="danger full"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    `Delete group “${editing.name}”? Cages and production records will be kept.`,
                  )
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  await farm.deleteGroup(editing.id);
                  await refresh();
                  setEditing(undefined);
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete group
            </button>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </Card>
  );
}
