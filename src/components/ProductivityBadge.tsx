import { number, status } from "../utils/calculations";
export function ProductivityBadge({ value }: { value: number | null }) {
  // Band from the displayed (rounded) value so 74.96 → "75% · Good", matching the legend.
  const level = status(value === null ? null : Number(value.toFixed(1)));
  const label = {
    good: "Good",
    watch: "Watch",
    low: "Low",
    unrecorded: "No rate",
  }[level];
  return (
    <span className={`productivity-badge ${level}`}>
      {value === null ? label : `${number(value)}% · ${label}`}
    </span>
  );
}
