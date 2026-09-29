"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { MealType } from "@/lib/types";
import { setAttendance } from "./actions";

export default function AttendanceToggle({
  date,
  mealType,
  initial,
  deadlineLabel,
  open,
}: {
  date: string;
  mealType: MealType;
  initial: boolean | null;
  deadlineLabel: string;
  open: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [value, setOptimistic] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const choose = (willEat: boolean) =>
    startTransition(async () => {
      setError(null);
      setOptimistic(willEat);
      const result = await setAttendance({ date, mealType, willEat });
      if (result.ok) setSaved(willEat);
      else setError(result.error);
    });

  const caption = open ? `Closes ${deadlineLabel}` : "Closed";

  return (
    <div className="flex w-24 shrink-0 flex-col items-stretch gap-1.5 rounded-lg bg-stone-50 p-2 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">Eating?</span>
      <button
        type="button"
        disabled={!open}
        aria-pressed={value === true}
        onClick={() => choose(true)}
        className={`rounded-md border px-2 py-1.5 text-sm font-medium transition ${
          value === true
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
        } disabled:cursor-not-allowed ${value === true ? "disabled:opacity-80" : "disabled:opacity-50"}`}
      >
        Yes
      </button>
      <button
        type="button"
        disabled={!open}
        aria-pressed={value === false}
        onClick={() => choose(false)}
        className={`rounded-md border px-2 py-1.5 text-sm font-medium transition ${
          value === false
            ? "border-stone-700 bg-stone-700 text-white"
            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
        } disabled:cursor-not-allowed ${value === false ? "disabled:opacity-80" : "disabled:opacity-50"}`}
      >
        No
      </button>
      <span className="text-[10px] leading-tight text-stone-500">{caption}</span>
      {error && <span className="text-[10px] leading-tight text-red-600">{error}</span>}
    </div>
  );
}
