import DateNav from "@/components/date-nav";
import { requireCommittee } from "@/lib/auth";
import { isoDateIST, isValidIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { MEAL_TYPES, type MealType } from "@/lib/types";
import CheckForm, { type ExistingCheck } from "./check-form";

export const metadata = { title: "Quality checks · Chachu ka Mittar" };

export default async function QualityPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [, { date: dateParam }, supabase] = await Promise.all([requireCommittee(), searchParams, createClient()]);
  const date = isValidIsoDate(dateParam) ? dateParam : isoDateIST();

  const [checksRes, attendanceRes] = await Promise.all([
    supabase
      .from("quality_checks")
      .select("meal_type, hygiene_ok, temperature_ok, quantity_ok, taste_ok, food_temp_c, notes, photo_url")
      .eq("menu_date", date),
    supabase.from("meal_attendance").select("meal_type").eq("menu_date", date).eq("will_eat", true),
  ]);
  const checks = new Map(
    (checksRes.data ?? []).map((c) => [c.meal_type as MealType, c as unknown as ExistingCheck]),
  );
  const headcount = new Map<MealType, number>();
  for (const a of attendanceRes.data ?? []) {
    headcount.set(a.meal_type as MealType, (headcount.get(a.meal_type as MealType) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <DateNav date={date} basePath="/admin/quality" />
      <p className="text-sm text-stone-600">
        Before each meal is served, tick each check, note the temperature and add a photo. Students see whether a meal
        was checked.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {MEAL_TYPES.map((m) => (
          <CheckForm
            key={`${date}-${m}`}
            date={date}
            mealType={m}
            existing={checks.get(m) ?? null}
            headcount={headcount.get(m) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
