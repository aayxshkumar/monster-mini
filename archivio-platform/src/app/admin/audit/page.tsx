import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog, users, cafes } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export default async function AuditLogPage() {
  await requireRole("super_admin");

  const entries = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      details: auditLog.details,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userEmail: users.email,
      cafeName: cafes.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .leftJoin(cafes, eq(auditLog.cafeId, cafes.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Recent admin actions across all cafes</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Cafe</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries yet
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className="font-medium">{entry.userName ?? "?"}</span>
                  <br />
                  <span className="text-xs text-muted-foreground">{entry.userEmail}</span>
                </td>
                <td className="px-4 py-2">{entry.cafeName ?? "—"}</td>
                <td className="px-4 py-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{entry.action}</code>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate">
                  {entry.details ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
