"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { landingPages, leads } from "@/db/schema";
import { withinLimit } from "@/lib/request";

const schema = z.object({
  email: z.email().max(254),
  message: z.string().max(2000).optional(),
});

export async function submitLead(slug: string, formData: FormData) {
  const done = `/launch/${encodeURIComponent(slug)}?submitted=1#lead-form`;
  // 蜜罐字段有值时假装成功，不写入数据。
  if (formData.get("company_site")) redirect(done);
  if (!(await withinLimit("lead", 10, 3600))) redirect(done);

  const parsed = schema.safeParse({
    email: formData.get("email"),
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) redirect(`/launch/${encodeURIComponent(slug)}#lead-form`);

  const db = getDb();
  const [page] = await db
    .select({ id: landingPages.id })
    .from(landingPages)
    .where(and(eq(landingPages.slug, slug), eq(landingPages.status, "published")));
  if (!page) redirect("/");

  await db
    .insert(leads)
    .values({
      landingPageId: page.id,
      email: parsed.data.email.toLowerCase(),
      message: parsed.data.message,
    })
    .onConflictDoNothing();
  redirect(done);
}
