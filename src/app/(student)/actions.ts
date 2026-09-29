"use server";

import { revalidatePath } from "next/cache";
import { isValidIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { MEAL_TYPES, type MealType } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendly(message: string) {
  return message.includes("row-level security")
    ? "This is closed now. Refresh the page to see the latest."
    : message;
}

export async function rateMeal(input: {
  mealId: string;
  stars: number;
  tags: string[];
  comment: string;
}): Promise<ActionResult> {
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) {
    return { ok: false, error: "Pick 1 to 5 stars." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_rating", {
    p_meal_id: input.mealId,
    p_stars: input.stars,
    p_tags: input.tags.slice(0, 10),
    p_comment: input.comment.slice(0, 500),
  });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/my-food");
  return { ok: true };
}

export async function setAttendance(input: {
  date: string;
  mealType: MealType;
  willEat: boolean;
}): Promise<ActionResult> {
  if (!isValidIsoDate(input.date) || !MEAL_TYPES.includes(input.mealType)) {
    return { ok: false, error: "Invalid meal." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase.from("meal_attendance").upsert({
    user_id: user.id,
    menu_date: input.date,
    meal_type: input.mealType,
    will_eat: input.willEat,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/my-food");
  return { ok: true };
}
