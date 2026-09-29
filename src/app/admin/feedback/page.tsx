import DateNav from "@/components/date-nav";
import { requireCommittee } from "@/lib/auth";
import { formatDateTimeIST, isoDateIST, isValidIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { MEAL_LABELS, MEAL_TYPES, type MealType } from "@/lib/types";

export const metadata = { title: "Feedback · Chachu ka Mittar" };

type Row = {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null; roll_no: string | null; room_no: string | null } | null;
  meals: { meal_type: MealType };
  rating_tags: { tags: { label: string; sentiment: string } }[];
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; meal?: string; low?: string }>;
}) {
  const [, params, supabase] = await Promise.all([requireCommittee(), searchParams, createClient()]);
  const date = isValidIsoDate(params.date) ? params.date : isoDateIST();
  const meal = MEAL_TYPES.includes(params.meal as MealType) ? (params.meal as MealType) : null;
  const lowOnly = params.low === "1";

  let query = supabase
    .from("ratings")
    .select(
      "id, stars, comment, created_at, profiles(full_name, roll_no, room_no), meals!inner(meal_type, menu_date), rating_tags(tags(label, sentiment))",
    )
    .eq("meals.menu_date", date)
    .order("created_at", { ascending: false });
  if (meal) query = query.eq("meals.meal_type", meal);
  if (lowOnly) query = query.lte("stars", 2);
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const link = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { date, meal, low: lowOnly ? "1" : null, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `/admin/feedback?${p}`;
  };

  return (
    <div className="space-y-4">
      <DateNav date={date} basePath="/admin/feedback" />

      <div className="flex flex-wrap gap-1.5 text-sm">
        {[null, ...MEAL_TYPES].map((t) => (
          <a
            key={t ?? "all"}
            href={link({ meal: t })}
            className={`rounded-full border px-3 py-1 ${meal === t ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 bg-white text-stone-600"}`}
          >
            {t ? MEAL_LABELS[t] : "All meals"}
          </a>
        ))}
        <a
          href={link({ low: lowOnly ? null : "1" })}
          className={`rounded-full border px-3 py-1 ${lowOnly ? "border-rose-600 bg-rose-600 text-white" : "border-stone-300 bg-white text-stone-600"}`}
        >
          Only 1–2 ★
        </a>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">No feedback for this selection.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">
                  {r.profiles?.full_name ?? "Student"}
                  <span className="font-normal text-stone-500">
                    {r.profiles?.roll_no && ` · ${r.profiles.roll_no}`}
                    {r.profiles?.room_no && ` · ${r.profiles.room_no}`}
                  </span>
                </span>
                <span className="text-xs text-stone-500">
                  {MEAL_LABELS[r.meals.meal_type]} · {formatDateTimeIST(r.created_at)}
                </span>
              </div>
              <p className={`mt-1 ${r.stars <= 2 ? "text-rose-500" : "text-amber-500"}`}>
                {"★".repeat(r.stars)}
                <span className="text-stone-300">{"★".repeat(5 - r.stars)}</span>
              </p>
              {r.rating_tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.rating_tags.map((t) => (
                    <span
                      key={t.tags.label}
                      className={`rounded-full px-2 py-0.5 text-xs ${t.tags.sentiment === "positive" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                    >
                      {t.tags.label}
                    </span>
                  ))}
                </div>
              )}
              {r.comment && <p className="mt-1.5 text-sm text-stone-700">“{r.comment}”</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
