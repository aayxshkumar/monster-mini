import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TemplateEditor } from "./template-editor";

export default async function AdminTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await params;
  const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
  if (!t) notFound();
  return (
    <div className="p-6 max-w-2xl">
      <Link href="/admin/templates" className="text-sm underline mb-4 inline-block">
        ← Templates
      </Link>
      <h1 className="text-xl font-semibold">Edit template</h1>
      <TemplateEditor template={t} />
    </div>
  );
}
