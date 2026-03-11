export default function BoothLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="space-y-3 text-center">
        <div className="loader-dots">
          <span />
          <span />
          <span />
        </div>
        <p className="text-sm text-muted-foreground">Loading booth...</p>
      </div>
    </div>
  );
}
