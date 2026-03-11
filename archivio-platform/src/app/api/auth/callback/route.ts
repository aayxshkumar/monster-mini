import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Sanitize redirect path: must be relative, no protocol tricks */
function sanitizeRedirect(raw: string | null): string {
  if (!raw) return "/admin";
  if (!/^\/[a-zA-Z0-9]/.test(raw)) return "/admin";
  if (raw.includes("//") || raw.includes("\\") || raw.includes("@")) return "/admin";
  try {
    const url = new URL(raw, "http://localhost");
    if (url.hostname !== "localhost") return "/admin";
  } catch {
    return "/admin";
  }
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirect(searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // exchangeCodeForSession threw — fall through to error redirect
    }
  }

  // Auth code exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
