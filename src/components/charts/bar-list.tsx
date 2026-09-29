/** Horizontal bars with the value at the tip. Server-renderable; hover shows the detail line. */
export default function BarList({
  rows,
  color,
  format = (v) => String(v),
  max,
}: {
  rows: { label: string; value: number; detail?: string }[];
  color: string;
  format?: (v: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="group relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm">
          <span className="truncate text-stone-700" title={r.label}>
            {r.label}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3.5 rounded-r-[4px] transition-opacity group-hover:opacity-80"
              style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, maxWidth: "calc(100% - 3rem)", background: color }}
            />
            <span className="shrink-0 text-xs font-medium text-stone-700">{format(r.value)}</span>
          </span>
          {r.detail && (
            <span className="pointer-events-none absolute -top-7 left-36 z-10 hidden whitespace-nowrap rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 shadow group-hover:block">
              {r.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
