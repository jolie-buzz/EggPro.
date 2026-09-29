import { CageGroups } from "./CageGroups";
import { ProductivityBadge } from "./ProductivityBadge";
import type { FarmRepository } from "../repositories/farm";
import { useState } from "react";
import type { State } from "../types/models";
import type { PeriodValue } from "./Period";
import { Card, Empty, Modal, Stat } from "./ui";
import { Chart } from "./Chart";
import { productivity } from "../services/productivity";
import { number } from "../utils/calculations";

const percent = (value: number | null) =>
  value === null ? "—" : `${number(value)}%`;

export function Productivity({
  state,
  period,
  farm,
  refresh,
}: {
  farm: FarmRepository;
  refresh: () => Promise<void>;
  state: State;
  period: PeriodValue;
}) {
  const [selection, setSelection] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("lowest");
  const [detail, setDetail] = useState<string | null>(null);
  const cages = [...state.cages].sort((a, b) =>
    a.cage_number.localeCompare(b.cage_number, undefined, { numeric: true }),
  );
  const selected = cages
    .filter((c) => selection === null || selection.includes(c.id))
    .map((c) => c.id);
  const report = productivity(state, period.start, period.end, selected);
  const visible = cages.filter((c) =>
    `${c.cage_number} ${c.name}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const rows = [...report.cages].sort((a, b) => {
    const byNumber = a.cage.cage_number.localeCompare(
      b.cage.cage_number,
      undefined,
      { numeric: true },
    );
    if (sort === "cage") return byNumber;
    if (a.rate === null || b.rate === null)
      return (a.rate === null ? 1 : 0) - (b.rate === null ? 1 : 0) || byNumber;
    return (
      (sort === "eggs"
        ? b.eggs - a.eggs
        : sort === "highest"
          ? b.rate - a.rate
          : a.rate - b.rate) || byNumber
    );
  });
  const detailCage = cages.find((c) => c.id === detail);
  const detailReport = detailCage
    ? productivity(state, period.start, period.end, [detailCage.id])
    : null;

  return (
    <>
      <Card>
        <h2>Productivity warnings</h2>
        <div className="productivity-legend">
          <span className="productivity-badge good">Good · ≥75%</span>
          <span className="productivity-badge watch">Watch · 50% to &lt;75%</span>
          <span className="productivity-badge low">Low · &lt;50%</span>
          <span className="productivity-badge unrecorded">
            No record / no rate
          </span>
        </div>
        <p className="hint">
          These are fixed productivity bands, not age-adjusted targets. Use
          group age/batch notes and recorded days to interpret the results.
        </p>
      </Card>
      <CageGroups
        state={state}
        period={period}
        farm={farm}
        refresh={refresh}
        select={(ids) => {
          setSelection(ids);
          document
            .getElementById("cage-picker")
            ?.scrollIntoView({ block: "start" });
        }}
      />
      <Card>
        <h2>Cage Performance</h2>
        <p>
          Compare productivity for one cage or a group. Choose your cages and
          sorting below.
        </p>
        <label className="field">
          <span>Sort cages by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="lowest">Lowest productivity first</option>
            <option value="highest">Highest productivity first</option>
            <option value="eggs">Most eggs first</option>
            <option value="cage">Cage number</option>
          </select>
        </label>
        <div className="cage-picker" id="cage-picker">
          <h3>Choose cages</h3>
          <p className="hint">
            Tick one cage or several cages to compare. All cages are selected to
            start.
          </p>
          <label className="field">
            <span>Search cages to compare</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cage number or name"
            />
          </label>
          <div className="selection-actions">
            <button onClick={() => setSelection(null)}>Select all cages</button>
            <button onClick={() => setSelection([])}>Clear selection</button>
          </div>
          <div
            className="cage-options"
            role="group"
            aria-label="Cages to compare"
          >
            {visible.map((c) => (
              <label className="cage-option" key={c.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    setSelection(
                      e.target.checked
                        ? [...selected, c.id]
                        : selected.filter((id) => id !== c.id),
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
            {!visible.length && <p>No matching cages.</p>}
          </div>
        </div>
        <p className="hint" aria-live="polite">
          {selected.length} cages selected · {period.start} to {period.end}
        </p>
      </Card>
      {!selected.length ? (
        <Card>
          <Empty
            title="Select cages to view productivity"
            detail="Choose one cage or a group using Choose cages above."
          />
        </Card>
      ) : (
        <>
          <div
            className="stats productivity-stats"
            aria-label="Selected cage summary"
          >
            <Stat label="Total eggs" value={number(report.eggs)} />
            <Stat
              label="Productivity"
              value={<ProductivityBadge value={report.rate} />}
            />
            <Stat
              label="Cages with records"
              value={`${report.recordedCages} / ${selected.length}`}
            />
          </div>
          <Card>
            <h2>Compare cages</h2>
            <div className="table-scroll">
              <table
                className="productivity-table"
                aria-label="Cage productivity comparison"
              >
                <thead>
                  <tr>
                    <th>Cage</th>
                    <th>Total eggs</th>
                    <th>Recorded days</th>
                    <th>Productivity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cage.id}>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setDetail(r.cage.id)}
                        >
                          Cage {r.cage.cage_number}
                        </button>
                        {r.cage.name && (
                          <small className="cage-name">{r.cage.name}</small>
                        )}
                        {r.cage.status === "inactive" && (
                          <small className="cage-name">Inactive</small>
                        )}
                      </td>
                      <td>{r.days ? number(r.eggs) : "—"}</td>
                      <td>
                        {r.days}/{report.days}
                      </td>
                      <td>
                        {r.days ? (
                          <ProductivityBadge value={r.rate} />
                        ) : (
                          <span className="productivity-badge unrecorded">
                            No record
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              Tap a cage for daily details. Cages without records stay below
              ranked cages. Compare recorded days too: incomplete entries can
              affect the comparison.
            </p>
            <p className="hint">
              Productivity = total eggs ÷ total hens saved across recorded days
              × 100. Recorded zero eggs count; missing entries do not.
              Historical hen counts are used even if the cage has changed. A
              dash means productivity cannot be calculated.
            </p>
          </Card>
          <Card>
            <h2>Selected cages · daily eggs</h2>
            <Chart data={report.series} />
            <p className="hint">
              A dash means no record. Totals include only recorded cages;
              missing entries are not zero eggs.
            </p>
          </Card>
        </>
      )}
      {detailCage && detailReport && (
        <Modal
          title={`Cage ${detailCage.cage_number} · daily productivity`}
          close={() => setDetail(null)}
        >
          <p>
            {period.start} to {period.end} · {percent(detailReport.rate)}{" "}
            productivity
          </p>
          <Chart data={detailReport.series} />
          <div className="table-scroll">
            <table aria-label="Daily cage productivity">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Eggs</th>
                  <th>Productivity</th>
                </tr>
              </thead>
              <tbody>
                {detailReport.series.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    <td>
                      {day.eggs === null ? "No record" : number(day.eggs)}
                    </td>
                    <td>
                      <ProductivityBadge value={day.rate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}
