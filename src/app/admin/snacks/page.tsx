import DateNav from "@/components/date-nav";
import Avatar from "@/components/avatar";
import SubmitForm from "@/components/submit-form";
import { isCommittee, requireStaff } from "@/lib/auth";
import { formatDateTimeIST, isoDateIST, isValidIsoDate } from "@/lib/dates";
import { getMealsForDate } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";
import { deleteSnack, logSnack } from "../actions";
import RollLookup from "./roll-lookup";

export const metadata = { title: "Snacks · Chachu ka Mittar" };

type Log = {
  id: string;
  roll_no: string;
  item: string;
  quantity: number;
  method: string;
  created_at: string;
  students: { full_name: string; photo_url: string | null; room_no: string | null } | null;
};

export default async function SnacksPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [profile, { date: dateParam }, supabase] = await Promise.all([requireStaff(), searchParams, createClient()]);
  const today = isoDateIST();
  const date = isValidIsoDate(dateParam) ? dateParam : today;

  const [studentsRes, logsRes, meals] = await Promise.all([
    supabase.from("students").select("roll_no, full_name, room_no, photo_url, email").order("roll_no"),
    supabase
      .from("snack_logs")
      .select("id, roll_no, item, quantity, method, created_at, students(full_name, photo_url, room_no)")
      .eq("menu_date", date)
      .order("created_at", { ascending: false }),
    getMealsForDate(date),
  ]);
  const students = (studentsRes.data ?? []) as Student[];
  const logs = (logsRes.data ?? []) as unknown as Log[];
  const snackItems = meals.find((m) => m.meal_type === "snacks")?.menu_items.map((i) => i.name) ?? [];

  const totals: Record<string, number> = {};
  for (const l of logs) totals[l.roll_no] = (totals[l.roll_no] ?? 0) + l.quantity;
  const repeaters = Object.entries(totals).filter(([, n]) => n > 1);
  const canDelete = isCommittee(profile);

  return (
    <div className="space-y-5">
      <DateNav date={date} basePath="/admin/snacks" />

      {date === today && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Log a snack</h2>
          <SubmitForm action={logSnack} submitLabel="Log snack" className="space-y-3">
            <input type="hidden" name="menu_date" value={date} />
            <RollLookup students={students} takenToday={totals} />
            <div className="flex gap-2">
              <input
                name="item"
                list="snack-items"
                defaultValue={snackItems[0] ?? ""}
                placeholder="Item"
                required
                className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2"
              />
              <datalist id="snack-items">
                {snackItems.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
              <input
                name="quantity"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                className="w-20 rounded-lg border border-stone-300 px-3 py-2"
              />
            </div>
          </SubmitForm>
          <p className="mt-2 text-xs text-stone-500">QR and face scanning will fill this in automatically in step 6.</p>
        </section>
      )}

      {repeaters.length > 0 && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="font-semibold text-rose-800">Took more than once ({repeaters.length})</h2>
          <p className="mt-1 text-sm text-rose-700">
            {repeaters
              .map(([roll, n]) => `${students.find((s) => s.roll_no === roll)?.full_name ?? roll} (${n})`)
              .join(", ")}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">
          Log <span className="font-normal text-stone-500">· {logs.length} entries</span>
        </h2>
        {logs.length === 0 ? (
          <p className="py-4 text-sm text-stone-400">Nothing logged.</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
                <Avatar src={l.students?.photo_url ?? null} name={l.students?.full_name ?? l.roll_no} size={32} />
                <div className="min-w-0 flex-1">
                  <p className={totals[l.roll_no] > 1 ? "font-medium text-rose-700" : "font-medium"}>
                    {l.students?.full_name ?? l.roll_no} <span className="font-normal text-stone-500">· {l.roll_no}</span>
                  </p>
                  <p className="text-stone-500">
                    {l.item}
                    {l.quantity > 1 && ` × ${l.quantity}`} · {formatDateTimeIST(l.created_at)}
                    {l.method !== "manual" && ` · ${l.method.toUpperCase()}`}
                  </p>
                </div>
                {canDelete && (
                  <form action={deleteSnack}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-xs text-stone-400 hover:text-red-600">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
