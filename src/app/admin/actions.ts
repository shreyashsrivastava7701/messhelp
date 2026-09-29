"use server";

import { revalidatePath } from "next/cache";
import { requireCommittee, requireStaff } from "@/lib/auth";
import { isValidIsoDate } from "@/lib/dates";
import type { StudentCsvRow } from "@/lib/csv";
import { normalizePhotoUrl } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string; at?: number };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function logSnack(_prev: FormState, fd: FormData): Promise<FormState> {
  const profile = await requireStaff();
  const roll = text(fd, "roll_no").toUpperCase();
  const item = text(fd, "item");
  const quantity = Number(fd.get("quantity") ?? 1);
  const date = text(fd, "menu_date");
  if (!roll || !item) return { error: "Enter a roll number and an item." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { error: "Quantity must be 1 to 20." };

  const supabase = await createClient();
  const { error } = await supabase.from("snack_logs").insert({
    roll_no: roll,
    item,
    quantity,
    menu_date: isValidIsoDate(date) ? date : undefined,
    logged_by: profile.id,
  });
  if (error) {
    return {
      error: error.message.includes("foreign key") ? `No student with roll number ${roll}.` : error.message,
    };
  }
  revalidatePath("/admin/snacks");
  revalidatePath("/admin");
  return { ok: true, at: Date.now() };
}

export async function deleteSnack(fd: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  await supabase.from("snack_logs").delete().eq("id", text(fd, "id"));
  revalidatePath("/admin/snacks");
  revalidatePath("/admin");
}

export async function postUpdate(_prev: FormState, fd: FormData): Promise<FormState> {
  const profile = await requireCommittee();
  const title = text(fd, "title");
  if (!title) return { error: "Add a title." };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title,
    body: text(fd, "body") || null,
    pinned: fd.get("pinned") === "on",
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/updates");
  revalidatePath("/updates");
  revalidatePath("/");
  return { ok: true, at: Date.now() };
}

export async function deleteUpdate(fd: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  await supabase.from("announcements").delete().eq("id", text(fd, "id"));
  revalidatePath("/admin/updates");
  revalidatePath("/updates");
  revalidatePath("/");
}

export async function addStudent(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireCommittee();
  const roll = text(fd, "roll_no").toUpperCase();
  const name = text(fd, "full_name");
  if (!roll || !name) return { error: "Roll number and name are required." };
  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    roll_no: roll,
    full_name: name,
    room_no: text(fd, "room_no") || null,
    email: text(fd, "email") || null,
    photo_url: normalizePhotoUrl(text(fd, "photo_url")),
  });
  if (error) {
    return { error: error.code === "23505" ? `Roll number ${roll} already exists.` : error.message };
  }
  revalidatePath("/admin/students");
  return { ok: true, at: Date.now() };
}

export async function deleteStudent(fd: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  await supabase.from("students").delete().eq("roll_no", text(fd, "roll_no"));
  revalidatePath("/admin/students");
}

export async function fillFromWeeklyMenu(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireCommittee();
  const from = text(fd, "from");
  if (!isValidIsoDate(from)) return { error: "Invalid date." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_weekly_menu", { p_from: from, p_days: 28 });
  if (error) return { error: error.message };
  revalidatePath("/admin/menu");
  revalidatePath("/");
  return { ok: true, at: Date.now(), error: data === 0 ? "Nothing to fill, those days already have menus." : undefined };
}

export type ImportResult = { ok: boolean; added: number; updated: number; skipped: string[]; error?: string };

/** Add or update roster rows from a CSV. Existing photos are kept when a row has no photo link. */
export async function importStudents(rows: StudentCsvRow[]): Promise<ImportResult> {
  await requireCommittee();
  const skipped: string[] = [];
  const seen = new Set<string>();
  const clean: { roll_no: string; full_name: string; room_no: string | null; email: string | null; photo_url: string | null }[] = [];

  rows.slice(0, 5000).forEach((r, i) => {
    const line = i + 2; // +1 for the header, +1 for 1-based lines
    const roll = String(r.roll_no ?? "").trim().toUpperCase();
    const name = String(r.full_name ?? "").trim();
    if (!roll || !name) return skipped.push(`Line ${line}: roll number or name missing`);
    if (seen.has(roll)) return skipped.push(`Line ${line}: ${roll} appears twice, kept the first`);
    seen.add(roll);
    const photo = normalizePhotoUrl(r.photo_url);
    if (r.photo_url?.trim() && !photo) skipped.push(`Line ${line}: ${roll} photo link isn't a web link, imported without it`);
    clean.push({ roll_no: roll, full_name: name, room_no: r.room_no?.trim() || null, email: r.email?.trim() || null, photo_url: photo });
  });

  if (!clean.length) return { ok: false, added: 0, updated: 0, skipped, error: "No valid rows to import." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("students").select("roll_no").in("roll_no", clean.map((c) => c.roll_no));
  const existingSet = new Set((existing ?? []).map((e) => e.roll_no));

  // Rows without a photo link are sent without the column, so an uploaded photo isn't wiped.
  const withPhoto = clean.filter((c) => c.photo_url);
  const withoutPhoto = clean
    .filter((c) => !c.photo_url)
    .map((c) => ({ roll_no: c.roll_no, full_name: c.full_name, room_no: c.room_no, email: c.email }));
  for (const batch of [withPhoto, withoutPhoto]) {
    for (let i = 0; i < batch.length; i += 500) {
      const { error } = await supabase.from("students").upsert(batch.slice(i, i + 500), { onConflict: "roll_no" });
      if (error) return { ok: false, added: 0, updated: 0, skipped, error: error.message };
    }
  }

  revalidatePath("/admin/students");
  const updated = clean.filter((c) => existingSet.has(c.roll_no)).length;
  return { ok: true, added: clean.length - updated, updated, skipped };
}

export async function generateSummary(_prev: FormState, fd: FormData): Promise<FormState> {
  const profile = await requireCommittee();
  const days = [7, 14, 30].includes(Number(fd.get("days"))) ? Number(fd.get("days")) : 7;
  const { getFeedbackStats } = await import("@/lib/feedback-stats");
  const { writeSummary, MissingKeyError, SUMMARY_MODEL } = await import("@/lib/ai-summary");
  const { isoDateIST } = await import("@/lib/dates");

  const stats = await getFeedbackStats(isoDateIST(), days);
  if (stats.ratingCount === 0) return { error: "No ratings in this period yet, so there's nothing to summarise." };

  let summary: string;
  try {
    summary = await writeSummary(stats);
  } catch (e) {
    if (e instanceof MissingKeyError) {
      return { error: "Add ANTHROPIC_API_KEY to .env.local and restart npm run dev to turn on AI summaries." };
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    if (e instanceof Anthropic.AuthenticationError) return { error: "The Claude API key was rejected. Check ANTHROPIC_API_KEY." };
    if (e instanceof Anthropic.RateLimitError) return { error: "Too many requests right now. Try again in a minute." };
    if (e instanceof Anthropic.APIError) return { error: `Claude API error (${e.status}). Try again shortly.` };
    return { error: e instanceof Error ? e.message : "Could not create the summary." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ai_summaries").insert({
    period_start: stats.from,
    period_end: stats.to,
    summary,
    rating_count: stats.ratingCount,
    comment_count: stats.comments.length,
    model: SUMMARY_MODEL,
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/insights");
  revalidatePath("/admin");
  return { ok: true, at: Date.now() };
}

export async function deleteSummary(fd: FormData) {
  await requireCommittee();
  const supabase = await createClient();
  await supabase.from("ai_summaries").delete().eq("id", text(fd, "id"));
  revalidatePath("/admin/insights");
}

export async function saveQualityCheck(input: {
  date: string;
  mealType: string;
  hygiene_ok: boolean;
  temperature_ok: boolean;
  quantity_ok: boolean;
  taste_ok: boolean;
  food_temp_c: number | null;
  notes: string;
  photo_url: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireCommittee();
  const { MEAL_TYPES } = await import("@/lib/types");
  if (!isValidIsoDate(input.date) || !MEAL_TYPES.includes(input.mealType as never)) return { ok: false, error: "Invalid meal." };
  const temp = input.food_temp_c;
  if (temp !== null && (!Number.isFinite(temp) || temp < 0 || temp > 120)) return { ok: false, error: "Temperature must be 0–120 °C." };

  const supabase = await createClient();
  const { error } = await supabase.from("quality_checks").upsert(
    {
      menu_date: input.date,
      meal_type: input.mealType,
      hygiene_ok: input.hygiene_ok,
      temperature_ok: input.temperature_ok,
      quantity_ok: input.quantity_ok,
      taste_ok: input.taste_ok,
      food_temp_c: temp,
      notes: input.notes.trim().slice(0, 1000) || null,
      photo_url: input.photo_url,
      checked_by: profile.id,
      created_at: new Date().toISOString(),
    },
    { onConflict: "menu_date,meal_type" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/quality");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function setKioskPin(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireCommittee();
  const pin = text(fd, "pin");
  if (!/^[0-9]{6,12}$/.test(pin)) return { error: "Use 6 to 12 digits." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_kiosk_pin", { p_pin: pin });
  if (error) return { error: error.message };
  revalidatePath("/admin/kiosk");
  return { ok: true, at: Date.now() };
}

export async function saveFaceDescriptors(
  rows: { roll_no: string; descriptor: number[]; photo_url: string | null }[],
): Promise<{ ok: boolean; error?: string }> {
  await requireCommittee();
  const clean = rows.filter(
    (r) => typeof r.roll_no === "string" && r.descriptor?.length === 128 && r.descriptor.every(Number.isFinite),
  );
  if (!clean.length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase
    .from("face_descriptors")
    .upsert(clean.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "roll_no" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/kiosk");
  return { ok: true };
}

export async function clearFaceData(): Promise<void> {
  await requireCommittee();
  const supabase = await createClient();
  await supabase.from("face_descriptors").delete().neq("roll_no", "");
  revalidatePath("/admin/kiosk");
}
