"use client";

import { useActionState, useState } from "react";
import VegMark from "@/components/veg-mark";
import { DEFAULT_TIMES, MEAL_LABELS, type Meal, type MealType } from "@/lib/types";
import { saveMeal, type SaveState } from "./actions";

type Row = { key: number; name: string; is_veg: boolean };

export default function MealEditor({
  date,
  mealType,
  meal,
}: {
  date: string;
  mealType: MealType;
  meal: Meal | undefined;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (meal?.menu_items ?? []).map((i, key) => ({ key, name: i.name, is_veg: i.is_veg })),
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, fd) => {
    const result = await saveMeal(prev, fd);
    if (result.ok) setDirty(false);
    return result;
  }, {});

  const update = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const addRow = () => {
    setRows((rs) => [...rs, { key: nextKey, name: "", is_veg: true }]);
    setNextKey((k) => k + 1);
    setDirty(true);
  };
  const removeRow = (key: number) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    setDirty(true);
  };

  const [start, end] = DEFAULT_TIMES[mealType];

  return (
    <form
      action={action}
      onChange={() => setDirty(true)}
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="menu_date" value={date} />
      <input type="hidden" name="meal_type" value={mealType} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(rows.map(({ name, is_veg }) => ({ name, is_veg })))}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{MEAL_LABELS[mealType]}</h2>
        <div className="flex items-center gap-1 text-sm">
          <input type="time" name="starts_at" defaultValue={meal?.starts_at?.slice(0, 5) ?? start} className="rounded border border-stone-300 px-1.5 py-0.5" />
          <span className="text-stone-400">to</span>
          <input type="time" name="ends_at" defaultValue={meal?.ends_at?.slice(0, 5) ?? end} className="rounded border border-stone-300 px-1.5 py-0.5" />
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update(row.key, { is_veg: !row.is_veg })}
              className="rounded p-1 hover:bg-stone-100"
              title="Toggle veg / non-veg"
            >
              <VegMark veg={row.is_veg} />
            </button>
            <input
              value={row.name}
              onChange={(e) => update(row.key, { name: e.target.value })}
              placeholder="Dish name"
              className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="rounded px-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove dish"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addRow} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
        + Add dish
      </button>

      <input
        name="note"
        defaultValue={meal?.note ?? ""}
        placeholder="Note for students (optional), e.g. Festival special"
        className="mt-3 w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
      />

      <div className="mt-3 flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && !dirty && <span className="text-sm text-emerald-700">Saved</span>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
