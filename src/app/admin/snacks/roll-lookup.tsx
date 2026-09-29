"use client";

import { useState } from "react";
import Avatar from "@/components/avatar";
import type { Student } from "@/lib/types";

/** Roll number box that shows the student's photo and name, so staff can check the face. */
export default function RollLookup({ students, takenToday }: { students: Student[]; takenToday: Record<string, number> }) {
  const [roll, setRoll] = useState("");
  const match = students.find((s) => s.roll_no === roll.trim().toUpperCase());
  const already = match ? (takenToday[match.roll_no] ?? 0) : 0;

  return (
    <div className="space-y-2">
      <input
        name="roll_no"
        value={roll}
        onChange={(e) => setRoll(e.target.value)}
        list="roll-list"
        placeholder="Roll number, e.g. 22CS001"
        autoComplete="off"
        autoFocus
        required
        className="w-full rounded-lg border border-stone-300 px-3 py-2 uppercase"
      />
      <datalist id="roll-list">
        {students.map((s) => (
          <option key={s.roll_no} value={s.roll_no}>
            {s.full_name}
          </option>
        ))}
      </datalist>
      {match && (
        <div className={`flex items-center gap-3 rounded-lg p-2 ${already ? "bg-rose-50" : "bg-emerald-50"}`}>
          <Avatar src={match.photo_url} name={match.full_name} size={44} />
          <div className="text-sm">
            <p className="font-medium">{match.full_name}</p>
            <p className={already ? "text-rose-700" : "text-emerald-700"}>
              {already ? `Already took ${already} today` : "Nothing taken today"}
              {match.room_no && <span className="text-stone-500"> · {match.room_no}</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
