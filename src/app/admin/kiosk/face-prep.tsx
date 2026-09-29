"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveFaceDescriptors } from "@/app/admin/actions";
import { describeFace, loadFaceApi, loadImage } from "@/lib/face";

type Todo = { roll_no: string; full_name: string; photo_url: string };
type Failure = { roll_no: string; full_name: string; reason: string };

/** Reads each roster photo in this browser and saves its face descriptor. */
export default function FacePrep({ todo }: { todo: Todo[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);

  const run = async () => {
    setRunning(true);
    setDone(0);
    setFailures([]);
    setStatus("Loading face models…");
    try {
      await loadFaceApi();
    } catch (e) {
      setStatus(`Couldn't load face models: ${(e as Error).message}`);
      setRunning(false);
      return;
    }
    setStatus(null);
    let batch: { roll_no: string; descriptor: number[]; photo_url: string }[] = [];
    const failed: Failure[] = [];
    const flush = async () => {
      if (!batch.length) return;
      const res = await saveFaceDescriptors(batch);
      if (!res.ok) throw new Error(res.error);
      batch = [];
    };
    try {
      for (let i = 0; i < todo.length; i++) {
        const s = todo[i];
        try {
          const res = await fetch(`/api/face-photo?roll=${encodeURIComponent(s.roll_no)}`);
          if (!res.ok) throw new Error(await res.text());
          const url = URL.createObjectURL(await res.blob());
          try {
            const img = await loadImage(url);
            const descriptor = await describeFace(img, 0.3);
            if (!descriptor) throw new Error("no face found in the photo");
            batch.push({ roll_no: s.roll_no, descriptor, photo_url: s.photo_url });
          } finally {
            URL.revokeObjectURL(url);
          }
        } catch (e) {
          failed.push({ roll_no: s.roll_no, full_name: s.full_name, reason: (e as Error).message });
          setFailures([...failed]);
        }
        setDone(i + 1);
        if (batch.length >= 20) await flush();
      }
      await flush();
      setStatus(`Finished. ${todo.length - failed.length} saved, ${failed.length} need a better photo.`);
    } catch (e) {
      setStatus(`Saving failed: ${(e as Error).message}`);
    }
    setRunning(false);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={run}
        disabled={running || todo.length === 0}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {running ? `Working… ${done} / ${todo.length}` : todo.length ? `Check ${todo.length} new photos now` : "All photos done"}
      </button>
      {running && (
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${(done / Math.max(todo.length, 1)) * 100}%` }} />
        </div>
      )}
      {status && <p className="text-sm text-stone-700">{status}</p>}
      {failures.length > 0 && (
        <details className="text-sm" open={failures.length <= 10}>
          <summary className="cursor-pointer text-rose-700">{failures.length} photos didn&apos;t work</summary>
          <ul className="mt-2 space-y-1 text-stone-600">
            {failures.map((f) => (
              <li key={f.roll_no}>
                <span className="font-medium">{f.roll_no}</span> {f.full_name}: {f.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
