"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { accountProjectToken } from "@/lib/customer-project";
import { withinLimit } from "@/lib/request";
import { rememberTrialProject } from "@/lib/trial-projects";
import { submitProject } from "@/workflow/intake";
import { startFreeDiagnosis } from "@/workflow/plans";

export async function createProjectAction(formData: FormData) {
  if (String(formData.get("website") ?? "").trim()) redirect("/");
  if (!(await withinLimit("new-project", 5, 3600))) {
    redirect(`/projects/new?error=${encodeURIComponent("提交太频繁，请稍后再试")}`);
  }
  const db = getDb();
  const session = await getCustomerSession();
  const { projectId, token, imageWarning } = await submitProject(db, formData, false, session?.user.id).catch((error: unknown) => {
    redirect(`/projects/new?error=${encodeURIComponent(error instanceof Error ? error.message : "提交失败")}`);
  });
  const query = new URLSearchParams({ intake: "public" });
  if (!session) await rememberTrialProject(token);
  let warning = imageWarning;
  try {
    await startFreeDiagnosis(db, projectId);
  } catch (error) {
    console.error("免费出海机会分析入队失败", error);
    warning = [warning, "项目已保存。暂未进入出海机会分析队列，请在项目页重试。"].filter(Boolean).join(" ");
  }
  if (warning) query.set("error", warning);
  redirect(`/p/${session ? accountProjectToken(projectId) : token}?${query}`);
}
