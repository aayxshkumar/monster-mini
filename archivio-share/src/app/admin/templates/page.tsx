import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/schema";
import Link from "next/link";
import { CreateTemplateForm } from "./create-form";

export default async function AdminTemplatesPage() {
  await auth();
  const list = await db.select().from(emailTemplates);

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Email Templates
          </h1>
          <p className="mt-1 text-sm text-foreground/50">
            {list.length} template{list.length !== 1 ? "s" : ""} configured.
          </p>
        </div>
        <CreateTemplateForm />
      </div>

      {list.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-foreground/10">
          <p className="text-sm text-foreground/40">No email templates yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-colors hover:border-foreground/20"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{t.name ?? t.id}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      t.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-foreground/10 text-foreground/40"
                    }`}
                  >
                    {t.isActive ? "Active" : "Draft"}
                  </span>
                </div>
                <p className="text-sm text-foreground/40">
                  {t.subject ?? "No subject"}
                </p>
              </div>
              <Link
                href={`/admin/templates/${t.id}`}
                className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
