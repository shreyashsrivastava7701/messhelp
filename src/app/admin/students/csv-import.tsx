"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readStudentCsv, type StudentCsvRow } from "@/lib/csv";
import { importStudents, type ImportResult } from "../actions";

export default function CsvImport() {
  const [rows, setRows] = useState<StudentCsvRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onFile = async (file: File | undefined) => {
    setResult(null);
    setProblem(null);
    setRows(null);
    if (!file) return;
    setFileName(file.name);
    const { rows, missing } = readStudentCsv(await file.text());
    if (missing.length) setProblem(`Couldn't find these columns in the header row: ${missing.join(", ")}.`);
    else if (!rows.length) setProblem("The file has a header but no students.");
    else setRows(rows);
  };

  const runImport = () =>
    startTransition(async () => {
      if (!rows) return;
      const res = await importStudents(rows);
      setResult(res);
      if (res.ok) {
        setRows(null);
        if (input.current) input.current.value = "";
        router.refresh();
      }
    });

  const withPhotos = rows?.filter((r) => r.photo_url).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50">
          Choose CSV file
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <a href="/students-template.csv" download className="text-sm text-emerald-700 hover:underline">
          Download template
        </a>
        {fileName && <span className="text-sm text-stone-500">{fileName}</span>}
      </div>

      {problem && <p className="text-sm text-red-600">{problem}</p>}

      {rows && (
        <div className="space-y-3">
          <p className="text-sm">
            <strong>{rows.length}</strong> students found, {withPhotos} with photo links. First few:
          </p>
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-2 py-1.5">Roll</th>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Room</th>
                  <th className="px-2 py-1.5">Photo</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <td className="px-2 py-1.5">{r.roll_no || <em className="text-red-500">missing</em>}</td>
                    <td className="px-2 py-1.5">{r.full_name || <em className="text-red-500">missing</em>}</td>
                    <td className="px-2 py-1.5">{r.room_no}</td>
                    <td className="max-w-40 truncate px-2 py-1.5 text-stone-500">{r.photo_url ? "link" : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={runImport}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "Importing…" : `Import ${rows.length} students`}
          </button>
        </div>
      )}

      {result && (
        <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {result.ok ? `Done: ${result.added} added, ${result.updated} updated.` : result.error}
          {result.skipped.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-stone-600">
              {result.skipped.slice(0, 10).map((s) => (
                <li key={s}>{s}</li>
              ))}
              {result.skipped.length > 10 && <li>…and {result.skipped.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
