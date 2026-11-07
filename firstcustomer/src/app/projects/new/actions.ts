"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { withinLimit } from "@/lib/request";
import { submitProject } from "@/workflow/intake";
import { startFreeDiagnosis } from "@/workflow/plans";

export async function createProjectAction(formData: FormData) {
  if (String(formData.get("website") ?? "").trim()) redirect("/");
  if (!(await withinLimit("new-project", 5, 3600))) {
    redirect(`/projects/new?error=${encodeURIComponent("提交太频繁，请稍后再试")}`);
  }
  const db = getDb();
  const { projectId, token, imageWarning } = await submitProject(db, formData).catch((error: unknown) => {
    redirect(`/projects/new?error=${encodeURIComponent(error instanceof Error ? error.message : "提交失败")}`);
  });
  const query = new URLSearchParams({ intake: "public" });
  let warning = imageWarning;
  try {
    await startFreeDiagnosis(db, projectId);
  } catch (error) {
    console.error("免费初诊入队失败", error);
    warning = [warning, "项目已保存。暂未进入初诊队列，请在项目页重试。"].filter(Boolean).join(" ");
  }
  if (warning) query.set("error", warning);
  redirect(`/p/${token}?${query}`);
}
