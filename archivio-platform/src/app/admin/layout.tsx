import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "cafe_operator") redirect("/");

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNav user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
