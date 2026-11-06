"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { withinLimit } from "@/lib/request";
import { submitProject } from "@/workflow/intake";

export async function createProjectAction(formData: FormData) {
  if (String(formData.get("website") ?? "").trim()) redirect("/");
  if (!(await withinLimit("new-project", 5, 3600))) {
    redirect(`/projects/new?error=${encodeURIComponent("提交太频繁，请稍后再试")}`);
  }
  let href: string;
  try {
    href = await submitProject(getDb(), formData);
  } catch (error) {
    redirect(`/projects/new?error=${encodeURIComponent(error instanceof Error ? error.message : "提交失败")}`);
  }
  redirect(href);
}
