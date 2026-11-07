"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { saveCompanySettings } from "@/workflow/company-context";

const settingsSchema = z.object({
  charter: z.string().trim().max(4000),
  brand: z.string().trim().max(2000),
  service: z.string().trim().max(3000),
  operations: z.string().trim().max(3000),
  forbiddenTerms: z.string().max(1600).transform((value) => [...new Set(value.split(/[\n,，]/).map((word) => word.trim()).filter(Boolean))]),
});

export async function saveCompanyContext(formData: FormData) {
  await requireAdmin("company.manage", "/admin/context");
  try {
    const values = settingsSchema.parse(Object.fromEntries(formData));
    await saveCompanySettings(getDb(), values, formData.get("intent") === "confirm");
  } catch (error) {
    redirect(`/admin/context?error=${encodeURIComponent(error instanceof Error ? error.message : "保存失败")}`);
  }
  revalidatePath("/admin/context");
  redirect("/admin/context");
}
