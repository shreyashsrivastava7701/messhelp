import Link from "next/link";
import { formatDateLong, isoDateIST } from "@/lib/dates";
import { shiftDate } from "@/lib/menu";

export default function DateNav({ date, basePath }: { date: string; basePath: string }) {
  const today = isoDateIST();
  const href = (d: string) => (d === today ? basePath : `${basePath}?date=${d}`);

  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={href(shiftDate(date, -1))} className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Previous day">
        ←
      </Link>
      <div className="text-center">
        <p className="font-semibold">{date === today ? "Today" : formatDateLong(date)}</p>
        {date === today ? (
          <p className="text-xs text-stone-500">{formatDateLong(date)}</p>
        ) : (
          <Link href={basePath} className="text-xs text-emerald-700 hover:underline">
            Back to today
          </Link>
        )}
      </div>
      <Link href={href(shiftDate(date, 1))} className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Next day">
        →
      </Link>
    </div>
  );
}
