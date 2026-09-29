import NotifyButton from "@/components/notify-button";
import { formatDateTimeIST } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/types";

export const metadata = { title: "Updates · Chachu ka Mittar" };

export default async function UpdatesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, pinned, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  const posts = (data ?? []) as Announcement[];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Updates from the mess</h1>
        <NotifyButton />
      </div>
      {posts.length === 0 && <p className="text-sm text-stone-500">No updates yet.</p>}
      {posts.map((p) => (
        <article key={p.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-medium">
              {p.pinned && <span className="mr-1.5 text-xs text-amber-600">📌</span>}
              {p.title}
            </h2>
            <time className="shrink-0 text-xs text-stone-400">{formatDateTimeIST(p.created_at)}</time>
          </div>
          {p.body && <p className="mt-1.5 whitespace-pre-line text-sm text-stone-600">{p.body}</p>}
        </article>
      ))}
    </div>
  );
}
