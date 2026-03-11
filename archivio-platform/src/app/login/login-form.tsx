"use client";

import { useState, useMemo } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

/** Sanitize redirect: must be a relative path */
function sanitizeRedirect(raw: string | null): string {
  if (!raw) return "/";
  if (!/^\/[a-zA-Z0-9]/.test(raw)) return "/";
  if (raw.includes("//") || raw.includes("\\") || raw.includes("@")) return "/";
  try {
    const url = new URL(raw, "http://localhost");
    if (url.hostname !== "localhost") return "/";
  } catch {
    return "/";
  }
  return raw;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = sanitizeRedirect(searchParams.get("redirect"));

  const supabase = useMemo(() => createSupabaseClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "reset") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/api/auth/callback?redirect=/login`,
        });
        if (err) throw err;
        setResetSent(true);
        setSuccess("Password reset link sent to your email.");
        setLoading(false);
        return;
      } else if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });
        if (err) throw err;
        setSuccess("Check your email for a confirmation link.");
        setLoading(false);
        return;
      }
      router.push(redirect);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "signup" | "reset") => {
    setMode(newMode);
    setError("");
    setSuccess("");
    setResetSent(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@cafe.com"
            required
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
        </div>

        {mode !== "reset" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={8}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>
        )}

        {mode === "reset" && (
          <p className="text-xs text-muted-foreground">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-primary">{success}</p>}

        {!resetSent && (
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60 animate-[pulse-dot_1.2s_ease-in-out_infinite]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60 animate-[pulse-dot_1.2s_ease-in-out_0.15s_infinite]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60 animate-[pulse-dot_1.2s_ease-in-out_0.3s_infinite]" />
              </span>
            ) : mode === "reset"
              ? "Send reset link"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        )}
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "reset" ? (
          <button
            onClick={() => switchMode("login")}
            className="underline hover:text-foreground"
          >
            Back to sign in
          </button>
        ) : mode === "login" ? (
          <>
            Need an account?{" "}
            <button
              onClick={() => switchMode("signup")}
              className="underline hover:text-foreground"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              onClick={() => switchMode("login")}
              className="underline hover:text-foreground"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </>
  );
}
