import type { Production, State } from "../types/models";
import { dayRange, sum } from "../utils/calculations";

function summarize(rows: Production[]) {
  const eggs = sum(rows, (r) => r.egg_count);
  const hens = sum(rows, (r) => r.hen_count_snapshot);
  return { eggs, rate: hens > 0 ? (eggs / hens) * 100 : null };
}

export function productivity(
  state: State,
  start: string,
  end: string,
  cageIds: string[],
) {
  const selected = new Set(cageIds);
  const dates = dayRange(start, end);
  const rows = state.daily_production.filter(
    (r) => selected.has(r.cage_id) && r.date >= start && r.date <= end,
  );
  const cages = state.cages
    .filter((c) => selected.has(c.id))
    .map((cage) => {
      const records = rows.filter((r) => r.cage_id === cage.id);
      return { cage, days: records.length, ...summarize(records) };
    });
  const series = dates.map((date) => {
    const records = rows.filter((r) => r.date === date);
    const summary = summarize(records);
    return {
      date,
      ...summary,
      eggs: records.length ? summary.eggs : null,
      recorded: records.length,
    };
  });
  return {
    ...summarize(rows),
    cages,
    series,
    days: dates.length,
    recordedCages: cages.filter((c) => c.days > 0).length,
  };
}
