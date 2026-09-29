"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { MEAL_LABELS, type MealType } from "@/lib/types";
import { saveQualityCheck } from "../actions";

const CHECKS = [
  { key: "hygiene_ok", label: "Hygiene", hint: "Clean kitchen, utensils, staff gloves and caps" },
  { key: "temperature_ok", label: "Temperature", hint: "Food served hot / cold as it should be" },
  { key: "quantity_ok", label: "Quantity", hint: "Enough for the expected headcount" },
  { key: "taste_ok", label: "Taste", hint: "Salt, spice and cooking are right" },
] as const;

type CheckKey = (typeof CHECKS)[number]["key"];
export type ExistingCheck = Record<CheckKey, boolean> & {
  food_temp_c: number | null;
  notes: string | null;
  photo_url: string | null;
};

export default function CheckForm({
  date,
  mealType,
  existing,
  headcount,
}: {
  date: string;
  mealType: MealType;
  existing: ExistingCheck | null;
  headcount: number;
}) {
  const [values, setValues] = useState<Record<CheckKey, boolean>>({
    hygiene_ok: existing?.hygiene_ok ?? true,
    temperature_ok: existing?.temperature_ok ?? true,
    quantity_ok: existing?.quantity_ok ?? true,
    taste_ok: existing?.taste_ok ?? true,
  });
  const [temp, setTemp] = useState(existing?.food_temp_c?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(existing ? "Saved earlier" : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      let photoUrl = existing?.photo_url ?? null;
      if (photo) {
        try {
          const supabase = createClient();
          const path = `${date}/${mealType}-${crypto.randomUUID().slice(0, 8)}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("quality-photos")
            .upload(path, await shrinkImage(photo, 1000, 0.8), { contentType: "image/jpeg" });
          if (upErr) throw upErr;
          photoUrl = supabase.storage.from("quality-photos").getPublicUrl(path).data.publicUrl;
        } catch (e) {
          setError(`Photo upload failed: ${e instanceof Error ? e.message : "unknown error"}`);
          return;
        }
      }
      const res = await saveQualityCheck({
        date,
        mealType,
        ...values,
        food_temp_c: temp.trim() === "" ? null : Number(temp),
        notes,
        photo_url: photoUrl,
      });
      if (res.ok) {
        setStatus("Saved ✓");
        setPhoto(null);
        router.refresh();
      } else setError(res.error ?? "Could not save.");
    });

  const issues = CHECKS.filter((c) => !values[c.key]).length;

  return (
    <section className={`rounded-xl border bg-white p-4 shadow-sm ${existing ? (issues ? "border-rose-300" : "border-emerald-300") : "border-stone-200"}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{MEAL_LABELS[mealType]}</h2>
        <span className="text-xs text-stone-500">{headcount} said they&apos;ll eat</span>
      </div>

      <ul className="mt-3 space-y-2">
        {CHECKS.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.label}</p>
              <p className="truncate text-xs text-stone-500">{c.hint}</p>
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-stone-300 text-xs font-medium">
              <button
                type="button"
                onClick={() => setValues((v) => ({ ...v, [c.key]: true }))}
                className={`px-3 py-1.5 ${values[c.key] ? "bg-emerald-600 text-white" : "bg-white text-stone-600"}`}
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setValues((v) => ({ ...v, [c.key]: false }))}
                className={`border-l border-stone-300 px-3 py-1.5 ${!values[c.key] ? "bg-rose-600 text-white" : "bg-white text-stone-600"}`}
              >
                Issue
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr]">
        <input
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          inputMode="decimal"
          placeholder="Temp °C"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={issues ? "What was wrong? (please add)" : "Notes (optional)"}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50">
          {photo ? `📷 ${photo.name.slice(0, 18)}` : existing?.photo_url ? "📷 Replace photo" : "📷 Add photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        {existing?.photo_url && !photo && (
          <a href={existing.photo_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline">
            View photo
          </a>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : existing ? "Update check" : "Save check"}
        </button>
      </div>
      {(status || error) && (
        <p className={`mt-2 text-xs ${error ? "text-red-600" : "text-emerald-700"}`}>{error ?? status}</p>
      )}
    </section>
  );
}
