import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 font-sans">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-muted">
        <svg className="h-10 w-10 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      </div>
      <h1 className="mt-6 text-xl font-bold tracking-tight text-foreground">
        Photo not found
      </h1>
      <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
        The photo may have expired or the link is incorrect. Check the code on
        your printed receipt and try again.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to home
      </Link>
    </div>
  );
}
