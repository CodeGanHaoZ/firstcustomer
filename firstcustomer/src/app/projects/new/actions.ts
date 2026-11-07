"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { accountProjectToken } from "@/lib/customer-project";
import { withinLimit } from "@/lib/request";
import { rememberTrialProject } from "@/lib/trial-projects";
import { submitProject } from "@/workflow/intake";
import { startFreeDiagnosis } from "@/workflow/plans";
import { activateAccountPro, customerMembership } from "@/workflow/membership";

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
    if (session && (await customerMembership(db, session.user.id)).plan === "pro") await activateAccountPro(db, projectId, session.user.id);
    else await startFreeDiagnosis(db, projectId);
  } catch (error) {
    console.error("项目执行任务入队失败", error);
    warning = [warning, "项目已保存，任务暂未入队。请返回工作台重新启动。"].filter(Boolean).join(" ");
  }
  if (warning) query.set("error", warning);
  redirect(`/p/${session ? accountProjectToken(projectId) : token}?${query}`);
}
