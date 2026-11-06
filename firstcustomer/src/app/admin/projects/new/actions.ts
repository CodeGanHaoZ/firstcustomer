"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { submitProject } from "@/workflow/intake";

export async function createFounderProjectAction(formData: FormData) {
  await requireAdmin();
  let href: string;
  try {
    href = await submitProject(getDb(), formData, true);
  } catch (error) {
    redirect(`/admin/projects/new?error=${encodeURIComponent(error instanceof Error ? error.message : "提交失败")}`);
  }
  redirect(href);
}
