import { shiftDate, today } from "../utils/calculations";
export type PeriodValue = { start: string; end: string };
export function Period({
  value,
  onChange,
  financial = false,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  financial?: boolean;
}) {
  const date = today();
  const weekday = (new Date(date + "T12:00:00").getDay() + 6) % 7;
  const options = financial
    ? [
        ["Today", date],
        ["This week", shiftDate(date, -weekday)],
        ["This month", date.slice(0, 7) + "-01"],
      ]
    : [
        ["Today", date],
        ["7 days", shiftDate(date, -6)],
        ["30 days", shiftDate(date, -29)],
      ];
  return (
    <div className="period">
      <div className="segmented">
        {options.map(([label, start]) => (
          <button
            key={label}
            className={
              value.start === start && value.end === date ? "selected" : ""
            }
            onClick={() => onChange({ start, end: date })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="date-range">
        <label>
          From
          <input
            aria-label="From date"
            type="date"
            max={value.end}
            value={value.start}
            onChange={(e) => {
              if (e.target.value) onChange({ ...value, start: e.target.value });
            }}
          />
        </label>
        <label>
          To
          <input
            aria-label="To date"
            type="date"
            min={value.start}
            max={date}
            value={value.end}
            onChange={(e) => {
              if (e.target.value) onChange({ ...value, end: e.target.value });
            }}
          />
        </label>
      </div>
    </div>
  );
}
