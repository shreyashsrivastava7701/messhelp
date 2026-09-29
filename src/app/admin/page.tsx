import Link from "next/link";
import DateNav from "@/components/date-nav";
import { requireCommittee } from "@/lib/auth";
import { isoDateIST, isValidIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { MEAL_LABELS, MEAL_TYPES, type MealType } from "@/lib/types";

export const metadata = { title: "Summary · Chachu ka Mittar" };

type RatingRow = {
  stars: number;
  meals: { meal_type: MealType };
  rating_tags: { tag_slug: string; tags: { label: string; sentiment: string } }[];
};

export default async function AdminSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [, { date: dateParam }, supabase] = await Promise.all([
    requireCommittee(),
    searchParams,
    createClient(),
  ]);
  const date = isValidIsoDate(dateParam) ? dateParam : isoDateIST();

  const [attendanceRes, ratingsRes, snacksRes, studentsRes, qualityRes, summaryRes] = await Promise.all([
    supabase.from("meal_attendance").select("meal_type, will_eat").eq("menu_date", date),
    supabase
      .from("ratings")
      .select("stars, meals!inner(meal_type, menu_date), rating_tags(tag_slug, tags(label, sentiment))")
      .eq("meals.menu_date", date),
    supabase.from("snack_logs").select("roll_no, quantity").eq("menu_date", date),
    supabase.from("students").select("roll_no", { count: "exact", head: true }),
    supabase
      .from("quality_checks")
      .select("meal_type, hygiene_ok, temperature_ok, quantity_ok, taste_ok, notes")
      .eq("menu_date", date),
    supabase
      .from("ai_summaries")
      .select("summary, period_start, period_end, created_at")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const quality = new Map(
    (qualityRes.data ?? []).map((q) => [
      q.meal_type as MealType,
      {
        issues: [q.hygiene_ok, q.temperature_ok, q.quantity_ok, q.taste_ok].filter((ok) => !ok).length,
        notes: q.notes as string | null,
      },
    ]),
  );
  const latestSummary = summaryRes.data?.[0];

  const headcount = new Map<MealType, { yes: number; no: number }>();
  for (const a of attendanceRes.data ?? []) {
    const h = headcount.get(a.meal_type as MealType) ?? { yes: 0, no: 0 };
    if (a.will_eat) h.yes++;
    else h.no++;
    headcount.set(a.meal_type as MealType, h);
  }

  const ratings = (ratingsRes.data ?? []) as unknown as RatingRow[];
  const perMeal = new Map<MealType, { count: number; sum: number; tags: Map<string, { n: number; sentiment: string }> }>();
  for (const r of ratings) {
    const m = perMeal.get(r.meals.meal_type) ?? { count: 0, sum: 0, tags: new Map() };
    m.count++;
    m.sum += r.stars;
    for (const t of r.rating_tags) {
      const cur = m.tags.get(t.tags.label) ?? { n: 0, sentiment: t.tags.sentiment };
      cur.n++;
      m.tags.set(t.tags.label, cur);
    }
    perMeal.set(r.meals.meal_type, m);
  }

  const snacks = snacksRes.data ?? [];
  const perStudent = new Map<string, number>();
  for (const s of snacks) perStudent.set(s.roll_no, (perStudent.get(s.roll_no) ?? 0) + s.quantity);
  const repeat = [...perStudent.values()].filter((n) => n > 1).length;
  const avgAll = ratings.length ? ratings.reduce((a, r) => a + r.stars, 0) / ratings.length : null;

  return (
    <div className="space-y-5">
      <DateNav date={date} basePath="/admin" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Average rating" value={avgAll ? `${avgAll.toFixed(1)} ★` : "–"} />
        <Stat label="Ratings" value={String(ratings.length)} />
        <Stat label="Snacks given" value={String(snacks.reduce((a, s) => a + s.quantity, 0))} />
        <Stat
          label="Took snacks twice+"
          value={String(repeat)}
          tone={repeat > 0 ? "text-rose-600" : undefined}
          href={`/admin/snacks?date=${date}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MEAL_TYPES.map((type) => {
          const h = headcount.get(type) ?? { yes: 0, no: 0 };
          const m = perMeal.get(type);
          const topTags = m ? [...m.tags.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 4) : [];
          return (
            <section key={type} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">{MEAL_LABELS[type]}</h2>
                <span className="text-sm text-amber-500">
                  {m ? `${(m.sum / m.count).toFixed(1)} ★ · ${m.count} rating${m.count > 1 ? "s" : ""}` : "No ratings"}
                </span>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-semibold text-emerald-700">{h.yes}</span> eating
                <span className="text-stone-400"> · </span>
                <span className="text-stone-600">{h.no} skipping</span>
                <span className="text-stone-400"> · {Math.max((studentsRes.count ?? 0) - h.yes - h.no, 0)} no answer</span>
              </p>
              <p className="mt-1 text-xs">
                {quality.has(type) ? (
                  quality.get(type)!.issues ? (
                    <span className="text-rose-700">
                      ⚠ Quality check: {quality.get(type)!.issues} issue(s)
                      {quality.get(type)!.notes && ` · ${quality.get(type)!.notes}`}
                    </span>
                  ) : (
                    <span className="text-emerald-700">✓ Quality checked</span>
                  )
                ) : (
                  <Link href={`/admin/quality?date=${date}`} className="text-stone-400 hover:text-emerald-700">
                    No quality check yet
                  </Link>
                )}
              </p>
              {topTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topTags.map(([label, t]) => (
                    <span
                      key={label}
                      className={`rounded-full px-2 py-0.5 text-xs ${t.sentiment === "positive" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                    >
                      {label} · {t.n}
                    </span>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {latestSummary && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Latest AI summary</h2>
            <Link href="/admin/insights" className="text-xs text-emerald-700 hover:underline">
              All summaries
            </Link>
          </div>
          <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm text-stone-700">{latestSummary.summary}</p>
        </section>
      )}

      <p className="text-sm text-stone-500">
        See charts in <Link href="/admin/trends" className="text-emerald-700 hover:underline">Trends</Link>. Read every comment in <Link href={`/admin/feedback?date=${date}`} className="text-emerald-700 hover:underline">Feedback</Link>.
      </p>
    </div>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: string; tone?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </>
  );
  const cls = "block rounded-xl border border-stone-200 bg-white p-3 shadow-sm";
  return href ? (
    <Link href={href} className={`${cls} hover:border-stone-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
