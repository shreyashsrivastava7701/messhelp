import { requireProfile } from "@/lib/auth";
import { formatDateLong, formatDateTimeIST, isoDateIST } from "@/lib/dates";
import { shiftDate } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import { MEAL_LABELS, MEAL_TYPES, type MealType } from "@/lib/types";

export const metadata = { title: "My food · Chachu ka Mittar" };

export default async function MyFoodPage() {
  const [profile, supabase] = await Promise.all([requireProfile(), createClient()]);
  const today = isoDateIST();
  const from = shiftDate(today, -14);

  const [snacksRes, attendanceRes, ratingsRes] = await Promise.all([
    supabase
      .from("snack_logs")
      .select("id, item, quantity, created_at")
      .eq("roll_no", profile.roll_no ?? "")
      .gte("menu_date", from)
      .order("created_at", { ascending: false }),
    supabase
      .from("meal_attendance")
      .select("menu_date, meal_type, will_eat")
      .eq("user_id", profile.id)
      .gte("menu_date", from)
      .order("menu_date", { ascending: false }),
    supabase
      .from("ratings")
      .select("id, stars, comment, meals!inner(menu_date, meal_type)")
      .eq("user_id", profile.id)
      .gte("meals.menu_date", from)
      .order("created_at", { ascending: false }),
  ]);

  const snacks = snacksRes.data ?? [];
  const attendanceByDate = new Map<string, Map<MealType, boolean>>();
  for (const a of attendanceRes.data ?? []) {
    const day = attendanceByDate.get(a.menu_date) ?? new Map();
    day.set(a.meal_type as MealType, a.will_eat);
    attendanceByDate.set(a.menu_date, day);
  }
  const ratings = (ratingsRes.data ?? []) as unknown as {
    id: string;
    stars: number;
    comment: string | null;
    meals: { menu_date: string; meal_type: MealType };
  }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My food</h1>
        <p className="text-sm text-stone-500">
          {profile.full_name}
          {profile.roll_no ? ` · ${profile.roll_no}` : " · roll number not linked, ask the mess committee"}
          {profile.room_no && ` · Room ${profile.room_no}`}
        </p>
      </div>

      <Section title="Snacks taken" subtitle="Last 14 days, as logged at the counter">
        {snacks.length === 0 ? (
          <Empty>No snacks logged.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {snacks.map((s) => (
              <li key={s.id} className="flex justify-between py-2 text-sm">
                <span>
                  {s.item}
                  {s.quantity > 1 && <span className="text-stone-500"> × {s.quantity}</span>}
                </span>
                <span className="text-stone-500">{formatDateTimeIST(s.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Meals I signed up for" subtitle="Your yes / no answers">
        {attendanceByDate.size === 0 ? (
          <Empty>You haven&apos;t answered for any meals yet. Use Yes / No on the menu.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {[...attendanceByDate.entries()].map(([date, meals]) => (
              <li key={date} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>{date === today ? "Today" : formatDateLong(date)}</span>
                <span className="flex gap-1">
                  {MEAL_TYPES.filter((t) => meals.has(t)).map((t) => (
                    <span
                      key={t}
                      className={`rounded-full px-2 py-0.5 text-xs ${meals.get(t) ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-500 line-through"}`}
                    >
                      {MEAL_LABELS[t]}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="My ratings">
        {ratings.length === 0 ? (
          <Empty>No ratings yet. Rate a meal from the menu after it&apos;s served.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {ratings.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <div className="flex justify-between">
                  <span>
                    {MEAL_LABELS[r.meals.meal_type]} ·{" "}
                    {r.meals.menu_date === today ? "Today" : formatDateLong(r.meals.menu_date)}
                  </span>
                  <span className="text-amber-500">{"★".repeat(r.stars)}</span>
                </div>
                {r.comment && <p className="text-stone-500">“{r.comment}”</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-stone-400">{children}</p>;
}
