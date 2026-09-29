import SubmitForm from "@/components/submit-form";
import { requireCommittee } from "@/lib/auth";
import { formatDateLong, formatDateTimeIST } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { deleteSummary, generateSummary } from "../actions";

export const metadata = { title: "AI summary · Chachu ka Mittar" };

type Summary = {
  id: string;
  period_start: string;
  period_end: string;
  summary: string;
  rating_count: number;
  comment_count: number;
  created_at: string;
};

export default async function InsightsPage() {
  await requireCommittee();
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_summaries")
    .select("id, period_start, period_end, summary, rating_count, comment_count, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const summaries = (data ?? []) as Summary[];
  const keySet = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">AI feedback summary</h1>
        <p className="mb-3 mt-1 text-sm text-stone-600">
          Claude reads every rating, tag and comment from the period and writes what students are unhappy about, what
          works, and one suggested action. Takes about 10–30 seconds.
        </p>
        {!keySet && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Not set up yet: add <code>ANTHROPIC_API_KEY=…</code> to <code>.env.local</code> and restart{" "}
            <code>npm run dev</code>. See UPDATING.md.
          </p>
        )}
        <SubmitForm action={generateSummary} submitLabel="Write summary" className="flex flex-wrap items-center gap-3">
          <select name="days" defaultValue="7" className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </SubmitForm>
      </section>

      {summaries.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No summaries yet.</p>
      ) : (
        summaries.map((s, i) => (
          <article
            key={s.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${i === 0 ? "border-emerald-300" : "border-stone-200"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {formatDateLong(s.period_start)} – {formatDateLong(s.period_end)}
              </h2>
              <span className="text-xs text-stone-500">
                {s.rating_count} ratings · {s.comment_count} comments · {formatDateTimeIST(s.created_at)}
              </span>
            </div>
            <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-800">{s.summary}</div>
            <form action={deleteSummary} className="mt-2 text-right">
              <input type="hidden" name="id" value={s.id} />
              <button className="text-xs text-stone-400 hover:text-red-600">Delete</button>
            </form>
          </article>
        ))
      )}
    </div>
  );
}
