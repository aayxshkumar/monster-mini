"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Image,
  Mail,
  Calendar,
  FileText,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/admin/photos", label: "Photos", icon: Image, exact: false },
  { href: "/admin/capsules", label: "Capsules", icon: Mail, exact: false },
  { href: "/admin/events", label: "Events", icon: Calendar, exact: false },
  { href: "/admin/templates", label: "Templates", icon: FileText, exact: false },
];

export function AdminSidebar({
  signOut,
}: {
  signOut: (opts: { redirectTo: string }) => Promise<never>;
}) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card/50">
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href="/admin" className="font-semibold tracking-tight text-foreground">
          Archivio
        </Link>
        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          Admin
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <form
          action={async () => {
            await signOut({ redirectTo: "/admin/login" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
