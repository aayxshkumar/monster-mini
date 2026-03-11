import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: raw } = await searchParams;
  const callbackUrl = raw ?? "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Archivio Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage your photos and events
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/5">
          <form
            className="space-y-4"
            action={async (formData) => {
              "use server";
              await signIn("credentials", {
                username: formData.get("username") as string,
                password: formData.get("password") as string,
                redirectTo: callbackUrl,
              });
            }}
          >
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
                placeholder="Enter password"
              />
            </div>
            <Button type="submit" className="w-full rounded-xl">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
