import { number, status } from "../utils/calculations";
export function ProductivityBadge({ value }: { value: number | null }) {
  const level = status(value);
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
