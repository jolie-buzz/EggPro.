import { number } from "../utils/calculations";
export function Chart({
  data,
}: {
  data: { date: string; eggs: number | null }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.eggs ?? 0));
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Egg production: ${data.map((d) => `${d.date}: ${d.eggs === null ? "No record" : d.eggs}`).join(", ")}`}
    >
      {data.map((d, i) => (
        <div
          className="chart-column"
          key={d.date}
          title={`${d.date}: ${d.eggs === null ? "No record" : `${d.eggs} eggs`}`}
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
