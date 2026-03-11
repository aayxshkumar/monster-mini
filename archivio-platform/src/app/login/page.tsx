import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left: Brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-primary/10 via-accent/5 to-background p-12">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary">
            Archivio
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Photo booth management platform
          </p>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground">
            Manage your
            <br />
            photo booths
            <br />
            <span className="text-primary">with ease.</span>
          </h1>
          <p className="max-w-md text-muted-foreground">
            Configure templates, manage staff, monitor print jobs, and
            customize the experience for each of your cafe locations.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                </svg>
              </div>
              Multi-cafe support
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M9.75 8.25h.008v.008H9.75V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </div>
              Remote print management
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/50">
          &copy; {new Date().getFullYear()} Archivio
        </p>
      </div>

      {/* Right: Login form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="lg:hidden mb-4">
              <h1 className="text-2xl font-bold tracking-tight text-primary">
                Archivio
              </h1>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to manage your photo booths
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/5">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
