import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  Card,
  Heading,
  Field,
  Form,
  Modal,
  NumberField,
  Empty,
  str,
  num,
} from "../components/ui";
import type { FarmRepository } from "../repositories/farm";
import type { State, Cage } from "../types/models";
export function Cages({
  state,
  farm,
  refresh,
  back,
}: {
  state: State;
  farm: FarmRepository;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Cage | null | undefined>(),
    [filter, setFilter] = useState("all");
  const rows = state.cages
    .filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        `${c.cage_number} ${c.name}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      a.cage_number.localeCompare(b.cage_number, undefined, { numeric: true }),
    );
  return (
    <>
      <Heading
        title="Cage management"
        subtitle={`${state.cages.filter((c) => c.status === "active").length} active cages · history always preserved`}
        back={back}
        action={
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={18} /> Add cage
          </button>
        }
      />
      <div className="toolbar">
        <input
          aria-label="Search cages"
          placeholder="Search cages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Cage status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All cages</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <Card>
        {rows.length ? (
          rows.map((c) => (
            <div className="list-row" key={c.id}>
              <div>
                <strong>
                  Cage {c.cage_number} {c.name && `· ${c.name}`}
                </strong>
                <small>
                  {c.hen_count} hens · {c.status}
                </small>
                {c.notes && <small>{c.notes}</small>}
              </div>
              <button
                className="icon"
                aria-label={`Edit Cage ${c.cage_number}`}
                onClick={() => setEditing(c)}
              >
                <Pencil size={18} />
              </button>
            </div>
          ))
        ) : (
          <Empty title="No matching cages" />
        )}
      </Card>
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit cage" : "Add cage"}
          close={() => setEditing(undefined)}
        >
          <Form
            onSave={async (d) => {
              const status = str(d, "status") as Cage["status"];
              if (
                editing?.status === "active" &&
                status === "inactive" &&
                !window.confirm(
                  "Deactivate this cage? All historical records will be kept.",
                )
              )
                return;
              await farm.saveCage(
                {
                  cage_number: str(d, "number"),
                  name: str(d, "name"),
                  hen_count: num(d, "hens"),
                  status,
                  notes: str(d, "notes"),
                },
                editing?.id,
              );
              await refresh();
              setEditing(undefined);
            }}
          >
            <Field label="Cage number">
              <input
                name="number"
                defaultValue={
                  editing?.cage_number ??
                  String(
                    Math.max(
                      0,
                      ...state.cages.map((c) => Number(c.cage_number) || 0),
                    ) + 1,
                  ).padStart(3, "0")
                }
                required
              />
            </Field>
            <Field label="Name · optional">
              <input name="name" defaultValue={editing?.name} />
            </Field>
            <NumberField
              label="Hens"
              name="hens"
              value={editing?.hen_count ?? 4}
            />
            <Field label="Status">
              <select name="status" defaultValue={editing?.status ?? "active"}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
