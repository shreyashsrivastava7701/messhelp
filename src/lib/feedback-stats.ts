import { shiftDate } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { MEAL_TYPES, type MealType } from "@/lib/types";

type RatingRow = {
  stars: number;
  comment: string | null;
  meal_id: string;
  meals: { menu_date: string; meal_type: MealType };
  rating_tags: { tags: { label: string; sentiment: string } | null }[];
};

export type FeedbackStats = {
  from: string;
  to: string;
  days: string[];
  ratingCount: number;
  avgStars: number | null;
  /** days x meals average stars (null when nobody rated). */
  dailyAvg: Record<MealType, (number | null)[]>;
  perMeal: Record<MealType, { count: number; avg: number | null }>;
  tags: { label: string; sentiment: string; count: number }[];
  /** Dishes by the average rating of the meals they were served in. */
  dishes: { name: string; avg: number; ratings: number; served: number }[];
  dailyYes: number[];
  comments: { date: string; meal: MealType; stars: number; text: string; tags: string[] }[];
};

/** Everything the trends page and the AI summary need for the last `days` days (India time). */
export async function getFeedbackStats(today: string, days: number): Promise<FeedbackStats> {
  const from = shiftDate(today, -(days - 1));
  const dayList = Array.from({ length: days }, (_, i) => shiftDate(from, i));
  const supabase = await createClient();

  const [ratingsRes, mealsRes, attendanceRes] = await Promise.all([
    supabase
      .from("ratings")
      .select("stars, comment, meal_id, meals!inner(menu_date, meal_type), rating_tags(tags(label, sentiment))")
      .gte("meals.menu_date", from)
      .lte("meals.menu_date", today)
      .limit(20000),
    supabase
      .from("meals")
      .select("id, menu_items(name)")
      .gte("menu_date", from)
      .lte("menu_date", today),
    supabase
      .from("meal_attendance")
      .select("menu_date")
      .eq("will_eat", true)
      .gte("menu_date", from)
      .lte("menu_date", today)
      .limit(50000),
  ]);

  const ratings = (ratingsRes.data ?? []) as unknown as RatingRow[];
  const dayIndex = new Map(dayList.map((d, i) => [d, i]));

  const sums = Object.fromEntries(MEAL_TYPES.map((m) => [m, dayList.map(() => ({ s: 0, n: 0 }))])) as Record<
    MealType,
    { s: number; n: number }[]
  >;
  const tagCounts = new Map<string, { sentiment: string; count: number }>();
  const byMeal = new Map<string, { s: number; n: number }>();

  for (const r of ratings) {
    const i = dayIndex.get(r.meals.menu_date);
    if (i === undefined) continue;
    sums[r.meals.meal_type][i].s += r.stars;
    sums[r.meals.meal_type][i].n++;
    const m = byMeal.get(r.meal_id) ?? { s: 0, n: 0 };
    m.s += r.stars;
    m.n++;
    byMeal.set(r.meal_id, m);
    for (const t of r.rating_tags) {
      if (!t.tags) continue;
      const c = tagCounts.get(t.tags.label) ?? { sentiment: t.tags.sentiment, count: 0 };
      c.count++;
      tagCounts.set(t.tags.label, c);
    }
  }

  const dailyAvg = Object.fromEntries(
    MEAL_TYPES.map((m) => [m, sums[m].map(({ s, n }) => (n ? s / n : null))]),
  ) as Record<MealType, (number | null)[]>;
  const perMeal = Object.fromEntries(
    MEAL_TYPES.map((m) => {
      const s = sums[m].reduce((a, d) => a + d.s, 0);
      const n = sums[m].reduce((a, d) => a + d.n, 0);
      return [m, { count: n, avg: n ? s / n : null }];
    }),
  ) as Record<MealType, { count: number; avg: number | null }>;

  // A dish's score = the stars given to every meal it was part of.
  const dishAgg = new Map<string, { s: number; n: number; served: number }>();
  for (const meal of (mealsRes.data ?? []) as { id: string; menu_items: { name: string }[] }[]) {
    const r = byMeal.get(meal.id);
    for (const item of meal.menu_items) {
      const d = dishAgg.get(item.name) ?? { s: 0, n: 0, served: 0 };
      d.served++;
      if (r) {
        d.s += r.s;
        d.n += r.n;
      }
      dishAgg.set(item.name, d);
    }
  }

  const dailyYes = dayList.map(() => 0);
  for (const a of attendanceRes.data ?? []) {
    const i = dayIndex.get(a.menu_date);
    if (i !== undefined) dailyYes[i]++;
  }

  return {
    from,
    to: today,
    days: dayList,
    ratingCount: ratings.length,
    avgStars: ratings.length ? ratings.reduce((a, r) => a + r.stars, 0) / ratings.length : null,
    dailyAvg,
    perMeal,
    tags: [...tagCounts.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.count - a.count),
    dishes: [...dishAgg.entries()]
      .filter(([, d]) => d.n >= 3)
      .map(([name, d]) => ({ name, avg: d.s / d.n, ratings: d.n, served: d.served }))
      .sort((a, b) => a.avg - b.avg),
    dailyYes,
    comments: ratings
      .filter((r) => r.comment)
      .map((r) => ({
        date: r.meals.menu_date,
        meal: r.meals.meal_type,
        stars: r.stars,
        text: r.comment!,
        tags: r.rating_tags.flatMap((t) => (t.tags ? [t.tags.label] : [])),
      })),
  };
}
