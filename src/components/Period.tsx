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
  const week = shiftDate(date, -weekday);
  const options = [
    ["Today", date, date],
    ["Yesterday", shiftDate(date, -1), shiftDate(date, -1)],
    ["This week", week, date],
    ["Last week", shiftDate(week, -7), shiftDate(week, -1)],
    ["This month", date.slice(0, 7) + "-01", date],
    ...(financial
      ? []
      : [
          ["7 days", shiftDate(date, -6), date],
          ["30 days", shiftDate(date, -29), date],
        ]),
  ];
  return (
    <div className="period">
      <div className="segmented">
        {options.map(([label, start, end]) => (
          <button
            key={label}
            className={
              value.start === start && value.end === end ? "selected" : ""
            }
            onClick={() => onChange({ start, end })}
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
