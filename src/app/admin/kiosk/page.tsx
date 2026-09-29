import Link from "next/link";
import SubmitForm from "@/components/submit-form";
import { requireCommittee } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { clearFaceData, setKioskPin } from "../actions";
import FacePrep from "./face-prep";

export const metadata = { title: `Kiosk · ${APP_NAME}` };

export default async function KioskSetupPage({ searchParams }: { searchParams: Promise<{ redo?: string }> }) {
  const [, { redo }, supabase] = await Promise.all([requireCommittee(), searchParams, createClient()]);
  const [studentsRes, facesRes, pinRes] = await Promise.all([
    supabase.from("students").select("roll_no, full_name, photo_url").order("roll_no"),
    supabase.from("face_descriptors").select("roll_no, photo_url"),
    supabase.rpc("kiosk_is_set"),
  ]);
  const setupMissing = !!facesRes.error || !!pinRes.error;
  const students = studentsRes.data ?? [];
  const faces = new Map((facesRes.data ?? []).map((f) => [f.roll_no as string, f.photo_url as string | null]));
  const withPhoto = students.filter((s) => s.photo_url);
  const todo = withPhoto
    .filter((s) => redo === "1" || faces.get(s.roll_no) !== s.photo_url)
    .map((s) => ({ roll_no: s.roll_no as string, full_name: s.full_name as string, photo_url: s.photo_url as string }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Snack kiosk</h1>
        <p className="mt-1 text-sm text-stone-600">
          A screen at the snack counter where students take a photo or scan their ID card. No sign-in needed; each
          student gets one snack a day. The Snacks page still works as a manual backup.
        </p>
      </div>

      {setupMissing && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run <code>supabase/migrations/20260929050000_kiosk.sql</code> in the Supabase SQL Editor first.
        </p>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">1. Kiosk PIN</h2>
        <p className="mt-1 text-sm text-stone-600">
          {pinRes.data ? "A PIN is set. Setting a new one signs out every kiosk." : "No PIN yet."} You type it once on
          the counter device.
        </p>
        <SubmitForm action={setKioskPin} submitLabel="Save PIN" className="mt-3 flex flex-wrap items-center gap-3">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            placeholder="6 to 12 digits"
            required
            className="w-44 rounded-lg border border-stone-300 px-3 py-2"
          />
        </SubmitForm>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">2. Face data (automatic)</h2>
        <p className="mt-1 text-sm text-stone-600">
          {faces.size} of {students.length} students have face data. The kiosk makes it by itself from the photos on
          the Students page, so there&apos;s nothing to do here. {students.length - withPhoto.length} students have no
          photo yet. Use the button only if you want to do it now or see which photos don&apos;t show a clear face.
        </p>
        <div className="mt-3">
          <FacePrep todo={todo} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
          <Link href="/admin/kiosk?redo=1" className="hover:text-stone-900">
            Redo everyone
          </Link>
          <form action={clearFaceData}>
            <button className="hover:text-rose-700">Delete all face data</button>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">3. Open the kiosk</h2>
        <p className="mt-1 text-sm text-stone-600">
          On the counter laptop or phone, open <span className="font-mono">/kiosk</span> on this site, enter the PIN
          and allow the camera. You can sign out of the committee account on that device.
        </p>
        <Link
          href="/kiosk"
          target="_blank"
          className="mt-3 inline-block rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Open kiosk ↗
        </Link>
      </section>
    </div>
  );
}
