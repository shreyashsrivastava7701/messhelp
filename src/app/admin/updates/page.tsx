import SubmitForm from "@/components/submit-form";
import { requireCommittee } from "@/lib/auth";
import { formatDateTimeIST } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/types";
import { deleteUpdate, postUpdate } from "../actions";

export const metadata = { title: "Updates · Chachu ka Mittar" };

export default async function AdminUpdatesPage() {
  await requireCommittee();
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, pinned, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  const posts = (data ?? []) as Announcement[];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Post an update</h2>
        <SubmitForm action={postUpdate} submitLabel="Post to students" className="space-y-3">
          <input
            name="title"
            required
            placeholder="e.g. Guest meal on Sunday, special paneer at dinner"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <textarea
            name="body"
            rows={3}
            placeholder="Details (optional)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" name="pinned" /> Pin to top
          </label>
        </SubmitForm>
      </section>

      <ul className="space-y-2">
        {posts.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div>
              <p className="font-medium">
                {p.pinned && "📌 "}
                {p.title}
              </p>
              {p.body && <p className="mt-0.5 whitespace-pre-line text-sm text-stone-600">{p.body}</p>}
              <p className="mt-1 text-xs text-stone-400">{formatDateTimeIST(p.created_at)}</p>
            </div>
            <form action={deleteUpdate}>
              <input type="hidden" name="id" value={p.id} />
              <button className="text-xs text-stone-400 hover:text-red-600">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
