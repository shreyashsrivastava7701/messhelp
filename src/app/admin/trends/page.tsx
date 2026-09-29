import Link from "next/link";
import BarList from "@/components/charts/bar-list";
import LineChart, { Legend } from "@/components/charts/line-chart";
import { requireCommittee } from "@/lib/auth";
import { isoDateIST } from "@/lib/dates";
import { getFeedbackStats } from "@/lib/feedback-stats";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/types";

export const metadata = { title: "Trends · Chachu ka Mittar" };

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const RANGES = [7, 14, 30];

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const [, { days: daysParam }] = await Promise.all([requireCommittee(), searchParams]);
  const days = RANGES.includes(Number(daysParam)) ? Number(daysParam) : 7;
  const stats = await getFeedbackStats(isoDateIST(), days);

  const series = MEAL_TYPES.map((m, i) => ({
    key: m,
    label: MEAL_LABELS[m],
    color: COLORS[i],
    values: stats.dailyAvg[m],
  }));
  const complaints = stats.tags.filter((t) => t.sentiment === "negative").slice(0, 8);
  const worstDishes = stats.dishes.slice(0, 8);
  const bestDishes = [...stats.dishes].reverse().slice(0, 5);
  const xLabels = stats.days.map(shortDay);
  const maxYes = Math.max(4, ...stats.dailyYes);
  const yesTop = Math.ceil(maxYes / 4) * 4;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Trends</h1>
        <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/trends?days=${r}`}
              className={`rounded-md px-3 py-1 ${r === days ? "bg-emerald-600 text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Average rating" value={stats.avgStars ? `${stats.avgStars.toFixed(2)} ★` : "–"} />
        <Tile label="Ratings" value={stats.ratingCount.toLocaleString("en-IN")} />
        <Tile label="Comments" value={stats.comments.length.toLocaleString("en-IN")} />
        <Tile label="Top complaint" value={complaints[0]?.label ?? "–"} small />
      </div>

      <Card title="Average rating per meal" subtitle="Hover or tap a day for exact values">
        {stats.ratingCount === 0 ? (
          <Empty />
        ) : (
          <>
            <Legend series={series} />
            <div className="mt-2">
              <LineChart xLabels={xLabels} series={series} yMin={1} yMax={5} yTicks={[1, 2, 3, 4, 5]} />
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs text-stone-500">Show as table</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-stone-500">
                    <tr>
                      <th className="py-1 pr-3">Day</th>
                      {MEAL_TYPES.map((m) => (
                        <th key={m} className="py-1 pr-3">
                          {MEAL_LABELS[m]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.days.map((d, i) => (
                      <tr key={d} className="border-t border-stone-100">
                        <td className="py-1 pr-3">{xLabels[i]}</td>
                        {MEAL_TYPES.map((m) => (
                          <td key={m} className="py-1 pr-3 tabular-nums">
                            {stats.dailyAvg[m][i]?.toFixed(1) ?? "–"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Most common complaints" subtitle="How many ratings used each tag">
          {complaints.length ? <BarList rows={complaints.map((t) => ({ label: t.label, value: t.count }))} color="var(--bar-bad)" /> : <Empty />}
        </Card>
        <Card title="Lowest-rated dishes" subtitle="Average stars of the meals a dish was in (3+ ratings)">
          {worstDishes.length ? (
            <BarList
              rows={worstDishes.map((d) => ({
                label: d.name,
                value: d.avg,
                detail: `${d.ratings} ratings over ${d.served} servings`,
              }))}
              color="var(--bar-bad)"
              format={(v) => `${v.toFixed(1)} ★`}
              max={5}
            />
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="Best-rated dishes">
          {bestDishes.length ? (
            <BarList
              rows={bestDishes.map((d) => ({ label: d.name, value: d.avg, detail: `${d.ratings} ratings` }))}
              color="var(--bar-good)"
              format={(v) => `${v.toFixed(1)} ★`}
              max={5}
            />
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="Rating by meal">
          <BarList
            rows={MEAL_TYPES.map((m) => ({
              label: MEAL_LABELS[m],
              value: stats.perMeal[m].avg ?? 0,
              detail: `${stats.perMeal[m].count} ratings`,
            }))}
            color="var(--bar-good)"
            format={(v) => (v ? `${v.toFixed(1)} ★` : "–")}
            max={5}
          />
        </Card>
      </div>

      <Card title="Students eating per day" subtitle="Total Yes answers across all meals">
        <LineChart
          xLabels={xLabels}
          series={[{ key: "yes", label: "Yes answers", color: "var(--series-1)", values: stats.dailyYes }]}
          yMin={0}
          yMax={yesTop}
          yTicks={[0, yesTop / 4, yesTop / 2, (3 * yesTop) / 4, yesTop]}
          height={180}
        />
      </Card>
    </div>
  );
}

function Tile({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-0.5 truncate font-semibold ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-stone-400">No ratings in this period yet.</p>;
}
