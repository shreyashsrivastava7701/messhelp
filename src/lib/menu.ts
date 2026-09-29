import { createClient } from "@/lib/supabase/server";
import { istInstant } from "@/lib/dates";
import { ATTENDANCE_CUTOFF_HOURS, DEFAULT_TIMES, MEAL_TYPES, type Meal, type MealType } from "@/lib/types";

/** All meals for a date, ordered breakfast to dinner, items in display order. */
export async function getMealsForDate(date: string): Promise<Meal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .select("id, menu_date, meal_type, starts_at, ends_at, note, updated_at, menu_items(id, name, is_veg, position)")
    .eq("menu_date", date);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Meal[])
    .map((m) => ({ ...m, menu_items: [...m.menu_items].sort((a, b) => a.position - b.position) }))
    .sort((a, b) => MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type));
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mealStart(date: string, type: MealType, meal?: Pick<Meal, "starts_at">): Date {
  return istInstant(date, meal?.starts_at ?? DEFAULT_TIMES[type][0]);
}

export function attendanceDeadline(date: string, type: MealType, meal?: Pick<Meal, "starts_at">): Date {
  return new Date(mealStart(date, type, meal).getTime() - ATTENDANCE_CUTOFF_HOURS * 3600_000);
}

/** Ratings open once a meal has started and stay open for 2 days. Mirrors rating_open() in SQL. */
export function canRate(date: string, type: MealType, meal: Pick<Meal, "starts_at">, today: string): boolean {
  return date >= shiftDate(today, -2) && Date.now() >= mealStart(date, type, meal).getTime();
}
