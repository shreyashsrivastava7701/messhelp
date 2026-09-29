import Link from "next/link";
import DateNav from "@/components/date-nav";
import VegMark from "@/components/veg-mark";
import { requireProfile } from "@/lib/auth";
import { formatClockIST, formatTime, isoDateIST, isValidIsoDate } from "@/lib/dates";
import { attendanceDeadline, canRate, getMealsForDate, shiftDate } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMES, MEAL_LABELS, MEAL_TYPES, type MealType, type Tag } from "@/lib/types";
import AttendanceToggle from "./attendance-toggle";
import RateMeal from "./rate-meal";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [profile, { date: dateParam }, supabase] = await Promise.all([
    requireProfile(),
    searchParams,
    createClient(),
  ]);
  const today = isoDateIST();
  const date = isValidIsoDate(dateParam) ? dateParam : today;

  const [meals, tagsRes, attendanceRes, announcementRes, qualityRes] = await Promise.all([
    getMealsForDate(date),
    supabase.from("tags").select("slug, label, sentiment").order("sentiment").order("label"),
    supabase
      .from("meal_attendance")
      .select("meal_type, will_eat")
      .eq("user_id", profile.id)
      .eq("menu_date", date),
    supabase
      .from("announcements")
      .select("id, title, created_at")
      .gte("created_at", new Date(Date.now() - 3 * 86400_000).toISOString())
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("quality_checks")
      .select("meal_type, hygiene_ok, temperature_ok, quantity_ok, taste_ok")
      .eq("menu_date", date),
  ]);

  const mealIds = meals.map((m) => m.id);
  const { data: ratingRows } = mealIds.length
    ? await supabase
        .from("ratings")
        .select("meal_id, stars, comment, rating_tags(tag_slug)")
        .eq("user_id", profile.id)
        .in("meal_id", mealIds)
    : { data: [] };

  const tags = (tagsRes.data ?? []) as Tag[];
  const byType = new Map(meals.map((m) => [m.meal_type, m]));
  const attendance = new Map(
    (attendanceRes.data ?? []).map((a) => [a.meal_type as MealType, a.will_eat as boolean]),
  );
  const myRatings = new Map(
    (ratingRows ?? []).map((r) => [
      r.meal_id as string,
      {
        stars: r.stars as number,
        comment: r.comment as string | null,
        tags: ((r.rating_tags ?? []) as { tag_slug: string }[]).map((t) => t.tag_slug),
      },
    ]),
  );
  const latest = announcementRes.data?.[0];
  const quality = new Map(
    (qualityRes.data ?? []).map((q) => [
      q.meal_type as MealType,
      [q.hygiene_ok, q.temperature_ok, q.quantity_ok, q.taste_ok].filter((ok) => !ok).length,
    ]),
  );
  const now = Date.now();
  const allClosed = MEAL_TYPES.every(
    (t) => now >= attendanceDeadline(date, t, byType.get(t)).getTime(),
  );

  return (
    <div className="space-y-4">
      {latest && (
        <Link
          href="/updates"
          className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 hover:bg-amber-100"
        >
          📣 {latest.title} <span className="text-amber-700">· see updates</span>
        </Link>
      )}

      <DateNav date={date} basePath="/" />

      {date === today && allClosed && (
        <Link
          href={`/?date=${shiftDate(today, 1)}`}
          className="block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 hover:bg-emerald-100"
        >
          Today&apos;s Yes / No has closed. <span className="font-medium underline">Tell us about tomorrow&apos;s meals →</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {MEAL_TYPES.map((type) => {
          const meal = byType.get(type);
          const start = formatTime(meal?.starts_at ?? `${DEFAULT_TIMES[type][0]}:00`);
          const end = formatTime(meal?.ends_at ?? `${DEFAULT_TIMES[type][1]}:00`);
          const deadline = attendanceDeadline(date, type, meal);
          const deadlineLabel =
            date === today
              ? formatClockIST(deadline)
              : date === shiftDate(today, 1)
                ? `tomorrow ${formatClockIST(deadline)}`
                : `${formatClockIST(deadline)} that day`;
          const rateable = !!meal && meal.menu_items.length > 0 && canRate(date, type, meal, today);

          return (
            <section key={type} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">{MEAL_LABELS[type]}</h2>
                <span className="text-xs text-stone-500">
                  {start} – {end}
                </span>
              </div>

              {quality.has(type) && (
                <p
                  className={`mt-1 text-xs font-medium ${quality.get(type) ? "text-rose-700" : "text-emerald-700"}`}
                >
                  {quality.get(type)
                    ? `⚠ Quality check found ${quality.get(type)} issue${quality.get(type)! > 1 ? "s" : ""}`
                    : "✓ Quality checked by the committee"}
                </p>
              )}

              {meal?.note && (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-800">{meal.note}</p>
              )}

              <div className="mt-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {meal && meal.menu_items.length > 0 ? (
                    <ul className="space-y-1.5">
                      {meal.menu_items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm">
                          <VegMark veg={item.is_veg} />
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-stone-400">Menu not posted yet.</p>
                  )}
                </div>
                <AttendanceToggle
                  date={date}
                  mealType={type}
                  initial={attendance.get(type) ?? null}
                  deadlineLabel={deadlineLabel}
                  open={now < deadline.getTime()}
                />
              </div>

              {rateable && (
                <div className="mt-auto pt-4"><div className="border-t border-stone-100 pt-3">
                  <RateMeal key={meal.id} mealId={meal.id} tags={tags} initial={myRatings.get(meal.id) ?? null} /></div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
