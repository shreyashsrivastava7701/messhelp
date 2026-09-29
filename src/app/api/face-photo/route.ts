import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Serves a student's roster photo from our own site, so the committee's browser can
 * read its pixels to make face data (Google Drive images can't be read cross-site).
 * Committee or the kiosk (with its PIN), and only fetches URLs already saved in the roster.
 */
export async function GET(request: NextRequest) {
  const roll = request.nextUrl.searchParams.get("roll") ?? "";
  const kioskPin = request.headers.get("x-kiosk-pin");
  const supabase = await createClient();
  let url: string | null | undefined;

  if (kioskPin) {
    // The kiosk has no account; the database checks its PIN.
    const { data } = await supabase.rpc("kiosk_photo_url", { p_pin: kioskPin, p_roll_no: roll });
    url = data as string | null;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new NextResponse("Sign in first", { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "committee" && profile?.role !== "admin") {
      return new NextResponse("Committee only", { status: 403 });
    }
    const { data: student } = await supabase.from("students").select("photo_url").eq("roll_no", roll).single();
    url = student?.photo_url;
  }
  if (!url || !/^https:\/\//.test(url)) return new NextResponse("No photo", { status: 404 });

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) {
      return new NextResponse("Photo link didn't return an image (is it shared as 'Anyone with the link'?)", {
        status: 422,
      });
    }
    const body = await res.arrayBuffer();
    if (body.byteLength > 8_000_000) return new NextResponse("Photo too large", { status: 413 });
    return new NextResponse(body, { headers: { "content-type": type, "cache-control": "private, max-age=300" } });
  } catch {
    return new NextResponse("Couldn't download the photo", { status: 502 });
  }
}
