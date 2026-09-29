/** Minimal CSV parser: commas, quoted fields, "" escapes, CRLF. Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export type StudentCsvRow = {
  roll_no: string;
  full_name: string;
  room_no: string;
  email: string;
  photo_url: string;
};

// Header names people are likely to use, mapped to our columns.
const ALIASES: Record<keyof StudentCsvRow, string[]> = {
  roll_no: ["roll_no", "roll no", "rollno", "roll", "roll number", "enrollment", "enrolment no"],
  full_name: ["full_name", "full name", "name", "student name"],
  room_no: ["room_no", "room no", "room", "room number"],
  email: ["email", "email id", "mail", "e-mail"],
  photo_url: ["photo_url", "photo url", "photo", "photo link", "image", "picture", "pic"],
};

/** Read a roster CSV. Column order doesn't matter; headers are matched loosely. */
export function readStudentCsv(text: string): { rows: StudentCsvRow[]; missing: string[] } {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], missing: ["roll_no", "full_name"] };
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[_\s]+/g, " "));
  const index = Object.fromEntries(
    (Object.keys(ALIASES) as (keyof StudentCsvRow)[]).map((key) => [
      key,
      norm.findIndex((h) => ALIASES[key].some((a) => a.replace(/_/g, " ") === h)),
    ]),
  ) as Record<keyof StudentCsvRow, number>;

  const missing = (["roll_no", "full_name"] as const).filter((k) => index[k] < 0);
  if (missing.length) return { rows: [], missing: [...missing] };

  const get = (r: string[], k: keyof StudentCsvRow) => (index[k] >= 0 ? (r[index[k]] ?? "").trim() : "");
  return {
    rows: body.map((r) => ({
      roll_no: get(r, "roll_no").toUpperCase(),
      full_name: get(r, "full_name"),
      room_no: get(r, "room_no"),
      email: get(r, "email"),
      photo_url: get(r, "photo_url"),
    })),
    missing: [],
  };
}
