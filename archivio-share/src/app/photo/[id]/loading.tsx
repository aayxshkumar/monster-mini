export default function PhotoLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-pulse">
      <div className="w-full max-w-md aspect-[3/4] rounded-lg bg-[var(--muted-foreground)]/20" />
      <div className="mt-4 h-4 w-32 rounded bg-[var(--muted-foreground)]/20" />
      <div className="mt-2 h-4 w-48 rounded bg-[var(--muted-foreground)]/20" />
    </div>
  );
}
