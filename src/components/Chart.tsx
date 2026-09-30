import { number } from "../utils/calculations";
export function Chart({
  data,
  unit = "eggs",
  label = "Egg production",
}: {
  data: { date: string; eggs: number | null }[];
  unit?: string;
  label?: string;
}) {
  // "%" charts scale to 100 so groups are comparable side by side.
  const max = Math.max(unit === "%" ? 100 : 1, ...data.map((d) => d.eggs ?? 0));
  const fmt = (v: number) => (unit === "%" ? `${number(v)}%` : `${v} ${unit}`);
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${label}: ${data.map((d) => `${d.date}: ${d.eggs === null ? "No record" : fmt(d.eggs)}`).join(", ")}`}
    >
      {data.map((d, i) => (
        <div
          className="chart-column"
          key={d.date}
          title={`${d.date}: ${d.eggs === null ? "No record" : fmt(d.eggs)}`}
        >
          <span>
            {data.length <= 14 ? (d.eggs === null ? "—" : number(d.eggs)) : ""}
          </span>
          <div className="bar-track">
            <div
              className="bar"
              style={{
                height: `${d.eggs === null ? 0 : Math.max(2, (d.eggs / max) * 100)}%`,
                minHeight: d.eggs === null ? 0 : undefined,
                opacity: i === data.length - 1 ? 1 : 0.65,
              }}
            />
          </div>
          <small>
            {data.length <= 7
              ? new Date(d.date + "T12:00:00").toLocaleDateString("en", {
                  weekday: "short",
                })
              : i % Math.ceil(data.length / 7) === 0
                ? d.date.slice(5)
                : ""}
          </small>
        </div>
      ))}
    </div>
  );
}
