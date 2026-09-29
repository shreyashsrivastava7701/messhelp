import Avatar from "@/components/avatar";
import SubmitForm from "@/components/submit-form";
import { requireCommittee } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";
import { addStudent, deleteStudent } from "../actions";
import CsvImport from "./csv-import";
import PhotoUpload from "./photo-upload";

export const metadata = { title: "Students · Chachu ka Mittar" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [, { q = "" }, supabase] = await Promise.all([requireCommittee(), searchParams, createClient()]);

  let query = supabase
    .from("students")
    .select("roll_no, full_name, room_no, photo_url, email")
    .order("roll_no")
    .limit(500);
  const term = q.trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`roll_no.ilike.%${term}%,full_name.ilike.%${term}%,room_no.ilike.%${term}%`);

  const [{ data }, { data: linked }, { data: allRolls }] = await Promise.all([
    query,
    supabase.from("profiles").select("roll_no").not("roll_no", "is", null),
    supabase.from("students").select("roll_no"),
  ]);
  const students = (data ?? []) as Student[];
  const hasApp = new Set((linked ?? []).map((p) => p.roll_no));

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Add a student</h2>
        <SubmitForm action={addStudent} submitLabel="Add student" className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="roll_no" required placeholder="Roll number *" className="rounded-lg border border-stone-300 px-3 py-2 uppercase" />
            <input name="full_name" required placeholder="Full name *" className="rounded-lg border border-stone-300 px-3 py-2" />
            <input name="room_no" placeholder="Room, e.g. A-101" className="rounded-lg border border-stone-300 px-3 py-2" />
            <input name="email" type="email" placeholder="Email" className="rounded-lg border border-stone-300 px-3 py-2" />
            <input name="photo_url" placeholder="Photo link, Google Drive links work (optional)" className="rounded-lg border border-stone-300 px-3 py-2 sm:col-span-2" />
          </div>
        </SubmitForm>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Import from CSV</h2>
        <p className="mb-3 mt-0.5 text-xs text-stone-500">
          Columns: roll_no, full_name, room_no, email, photo_url. Only roll number and name are required. Existing roll
          numbers are updated. Google Drive photo links work if the file is shared as &quot;Anyone with the link&quot;.
        </p>
        <CsvImport />
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Upload photos</h2>
        <p className="mb-3 mt-0.5 text-xs text-stone-500">
          Name each photo by roll number, like 22CS001.jpg, and pick the whole folder. Photos are shrunk before upload
          and replace the student&apos;s current photo.
        </p>
        <PhotoUpload rollNumbers={(allRolls ?? []).map((r) => r.roll_no)} />
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <form className="mb-3 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search roll number, name or room"
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg border border-stone-300 px-3 text-sm">Search</button>
        </form>
        <p className="mb-1 text-xs text-stone-500">{students.length} students</p>
        <ul className="divide-y divide-stone-100">
          {students.map((s) => (
            <li key={s.roll_no} className="flex items-center gap-3 py-2 text-sm">
              <Avatar src={s.photo_url} name={s.full_name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.full_name}{" "}
                  {hasApp.has(s.roll_no) && (
                    <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700">ON APP</span>
                  )}
                </p>
                <p className="truncate text-stone-500">
                  {s.roll_no}
                  {s.room_no && ` · ${s.room_no}`}
                  {s.email && ` · ${s.email}`}
                </p>
              </div>
              <form action={deleteStudent}>
                <input type="hidden" name="roll_no" value={s.roll_no} />
                <button className="text-xs text-stone-400 hover:text-red-600">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
