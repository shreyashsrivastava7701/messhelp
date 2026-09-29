import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Signed-in user's profile, or a redirect to /login. Cached for the whole request. */
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, room_no, roll_no, role")
    .eq("id", user.id)
    .single();

  return (
    profile ?? { id: user.id, full_name: user.email ?? null, room_no: null, roll_no: null, role: "student" }
  );
});

export function isCommittee(profile: Profile) {
  return profile.role === "committee" || profile.role === "admin";
}

export function isStaffOrCommittee(profile: Profile) {
  return isCommittee(profile) || profile.role === "staff";
}

/** Committee/admin only. Counter staff are sent to the snack log, students to the menu. */
export async function requireCommittee(): Promise<Profile> {
  const profile = await requireProfile();
  if (isCommittee(profile)) return profile;
  redirect(profile.role === "staff" ? "/admin/snacks" : "/");
}

export async function requireStaff(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isStaffOrCommittee(profile)) redirect("/");
  return profile;
}
