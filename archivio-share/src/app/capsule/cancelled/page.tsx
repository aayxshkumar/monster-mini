import Link from "next/link";

export default function CapsuleCancelledPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <h1 className="text-xl font-semibold mb-2">Capsule cancelled</h1>
      <p className="text-muted-foreground text-sm mb-6">
        This time capsule will not be delivered.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-foreground text-background hover:bg-foreground/90"
      >
        Go home
      </Link>
    </div>
  );
}
