"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "student-photos";
const PARALLEL = 4;

type Progress = { done: number; total: number; failed: string[]; unmatched: string[] };

/** Pick a folder of photos named by roll number (22CS001.jpg) and attach each to that student. */
export default function PhotoUpload({ rollNumbers }: { rollNumbers: string[] }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const router = useRouter();
  const known = new Set(rollNumbers);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const images = [...list].filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f.name) || f.type.startsWith("image/"));
    const rollOf = (f: File) => f.name.replace(/\.[^.]+$/, "").trim().toUpperCase();
    const matched = images.filter((f) => known.has(rollOf(f)));
    const unmatched = images.filter((f) => !known.has(rollOf(f))).map((f) => f.name);

    setRunning(true);
    const state: Progress = { done: 0, total: matched.length, failed: [], unmatched };
    setProgress({ ...state });
    const supabase = createClient();

    const one = async (file: File) => {
      const roll = rollOf(file);
      try {
        const blob = await shrinkImage(file);
        const path = `${roll}-${crypto.randomUUID().slice(0, 8)}.jpg`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const { error: dbErr } = await supabase.from("students").update({ photo_url: url }).eq("roll_no", roll);
        if (dbErr) throw dbErr;
      } catch (e) {
        state.failed.push(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
      state.done++;
      setProgress({ ...state });
    };

    const queue = [...matched];
    await Promise.all(
      Array.from({ length: PARALLEL }, async () => {
        for (let f = queue.shift(); f; f = queue.shift()) await one(f);
      }),
    );
    setRunning(false);
    router.refresh();
  };

  const picker = (folder: boolean) => (
    <label
      className={`cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50 ${running ? "pointer-events-none opacity-50" : ""}`}
    >
      {folder ? "Choose photo folder" : "Choose photos"}
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
        {...(folder ? { webkitdirectory: "", directory: "" } : {})}
      />
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {picker(true)}
        {picker(false)}
      </div>

      {progress && (
        <div className="space-y-2 text-sm">
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
            />
          </div>
          <p>
            {running ? "Uploading" : "Uploaded"} {progress.done - progress.failed.length} of {progress.total} photos
            {!running && progress.failed.length > 0 && `, ${progress.failed.length} failed`}.
          </p>
          {progress.unmatched.length > 0 && (
            <p className="text-xs text-amber-700">
              No student with these roll numbers, skipped: {progress.unmatched.slice(0, 8).join(", ")}
              {progress.unmatched.length > 8 && ` and ${progress.unmatched.length - 8} more`}
            </p>
          )}
          {!running && progress.failed.length > 0 && (
            <p className="text-xs text-red-600">{progress.failed.slice(0, 5).join("; ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
