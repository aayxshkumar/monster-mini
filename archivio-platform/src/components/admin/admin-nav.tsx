"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Settings,
  FileText,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import type { PlatformUser } from "@/types";

export function AdminNav({ user }: { user: PlatformUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/cafes", label: "Cafes", icon: Store },
    ...(user.role === "super_admin"
      ? [
          { href: "/admin/audit", label: "Audit log", icon: FileText },
          { href: "/admin/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setMobileOpen((p) => !p)}
            className="sm:hidden rounded-lg p-1.5 hover:bg-muted transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          <Link href="/admin" className="text-sm font-bold tracking-tight text-primary">
            Archivio
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {links.map((link) => {
              const isActive = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <link.icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <div className="hidden sm:block text-right">
            <p className="text-xs font-medium">{user.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {user.role.replace("_", " ")}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="sm:hidden border-t border-border bg-background px-4 py-2 space-y-1 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {links.map((link) => {
            const isActive = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          <div className="border-t border-border pt-2 mt-2">
            <p className="px-3 text-xs font-medium">{user.name}</p>
            <p className="px-3 text-[10px] text-muted-foreground capitalize">
              {user.role.replace("_", " ")}
            </p>
          </div>
        </div>
      )}
    </nav>
  );
}
