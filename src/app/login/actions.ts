"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (formData.get("portal") === "admin") return adminSignIn(formData);
  return formData.get("mode") === "signup" ? signUp(formData) : studentSignIn(formData);
}

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

async function studentSignIn(formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) return { error: error.message };
  redirect("/");
}

async function adminSignIn(formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role === "committee" || profile?.role === "admin") redirect("/admin");
  if (profile?.role === "staff") redirect("/admin/snacks");

  await supabase.auth.signOut();
  return { error: "This account isn't a mess committee or staff account. Use Student login instead." };
}

async function signUp(formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    ...credentials(formData),
    options: {
      data: {
        full_name: String(formData.get("full_name") ?? "").trim() || undefined,
        roll_no: String(formData.get("roll_no") ?? "").trim().toUpperCase() || undefined,
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  // With email confirmation off, Supabase returns a session straight away.
  if (data.session) redirect("/");
  return { message: "Check your email for a confirmation link, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
