"use server";

import { revalidatePath } from "next/cache";
import { isCommittee, requireProfile } from "@/lib/auth";
import { isValidIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { MEAL_TYPES, type MealType } from "@/lib/types";

export type SaveState = { ok?: boolean; error?: string; savedAt?: number };

type ItemInput = { name: string; is_veg: boolean };

export async function saveMeal(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const profile = await requireProfile();
  if (!isCommittee(profile)) return { error: "Only the mess committee can edit the menu." };

  const date = String(formData.get("menu_date") ?? "");
  const mealType = String(formData.get("meal_type") ?? "") as MealType;
  if (!isValidIsoDate(date) || !MEAL_TYPES.includes(mealType)) return { error: "Invalid date or meal." };

  let items: ItemInput[];
  try {
    items = (JSON.parse(String(formData.get("items") ?? "[]")) as ItemInput[])
      .map((i) => ({ name: String(i.name).trim(), is_veg: Boolean(i.is_veg) }))
      .filter((i) => i.name.length > 0);
  } catch {
    return { error: "Could not read the item list." };
  }
  const names = items.map((i) => i.name.toLowerCase());
  if (new Set(names).size !== names.length) return { error: "The same dish is listed twice." };

  const supabase = await createClient();

  const { data: meal, error: mealError } = await supabase
    .from("meals")
    .upsert(
      {
        menu_date: date,
        meal_type: mealType,
        starts_at: String(formData.get("starts_at") ?? "") || null,
        ends_at: String(formData.get("ends_at") ?? "") || null,
        note: String(formData.get("note") ?? "").trim() || null,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "menu_date,meal_type" },
    )
    .select("id")
    .single();
  if (mealError || !meal) return { error: mealError?.message ?? "Could not save the meal." };

  // Keep existing item rows where the dish is unchanged so ratings tied to a dish survive edits.
  const { data: existing, error: readError } = await supabase
    .from("menu_items")
    .select("id, name")
    .eq("meal_id", meal.id);
  if (readError) return { error: readError.message };

  const removed = (existing ?? []).filter((e) => !items.some((i) => i.name === e.name)).map((e) => e.id);
  if (removed.length) {
    const { error } = await supabase.from("menu_items").delete().in("id", removed);
    if (error) return { error: error.message };
  }

  if (items.length) {
    const { error } = await supabase.from("menu_items").upsert(
      items.map((i, position) => ({ meal_id: meal.id, name: i.name, is_veg: i.is_veg, position })),
      { onConflict: "meal_id,name" },
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/admin/menu");
  return { ok: true, savedAt: Date.now() };
}
