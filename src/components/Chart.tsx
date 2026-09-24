import { number } from "../utils/calculations";
export function Chart({ data }: { data: { date: string; eggs: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.eggs));
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Egg production: ${data.map((d) => `${d.date}: ${d.eggs}`).join(", ")}`}
    >
      {data.map((d, i) => (
        <div
          className="chart-column"
          key={d.date}
          title={`${d.date}: ${d.eggs} eggs`}
        >
          <span>{data.length <= 14 ? number(d.eggs) : ""}</span>
          <div className="bar-track">
            <div
              className="bar"
              style={{
                height: `${Math.max(2, (d.eggs / max) * 100)}%`,
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
