"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerAuth, getCustomerSession } from "@/lib/customer-auth";
import { getDb } from "@/db";
import { claimTrialProjects, clearTrialProjects, trialProjectTokens } from "@/lib/trial-projects";
import { customerLandingPath } from "@/lib/auth-return";
import { PRO_MODULES } from "@/domain/membership";
import { accountProjectToken } from "@/lib/customer-project";
import { activateAccountPro, customerMembership } from "@/workflow/membership";
import { and, eq } from "drizzle-orm";
import { agentTasks, projects } from "@/db/schema";
import { AGENT_STATUSES, isAccountPro, type ProjectStatus } from "@/domain/workflow";
import { enqueueAdvance } from "@/jobs/queue";
import { startReview } from "@/workflow/actions";

export async function customerLoginDestinationAction(returnTo: unknown) {
  const session = await getCustomerSession();
  if (!session) throw new Error("请先登录");
  return customerLandingPath(returnTo, (await customerMembership(getDb(), session.user.id)).plan);
}

export async function enterProModuleAction(projectId: string, moduleKey: string) {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=%2Faccount%2Fpro");
  const workModule = PRO_MODULES.find((item) => item.key === moduleKey);
  if (!workModule) throw new Error("工作模块不存在");
  if ((await customerMembership(getDb(), session.user.id)).plan !== "pro") redirect("/account/upgrade");
  const activated = await activateAccountPro(getDb(), projectId, session.user.id);
  const db = getDb();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.customerId, session.user.id)));
  if (!project) throw new Error("项目不属于当前客户账号。");
  if (isAccountPro(project) && !project.paused) {
    if (workModule.key === "growth" && ["published", "collecting"].includes(project.status)) await startReview(db, enqueueAdvance, projectId, "customer");
    else if (!activated && AGENT_STATUSES.includes(project.status as ProjectStatus)) {
      const [running] = await db.select({ id: agentTasks.id }).from(agentTasks).where(and(eq(agentTasks.projectId, projectId), eq(agentTasks.status, "running"))).limit(1);
      if (!running) await enqueueAdvance(projectId);
    }
  }
  redirect(`/p/${accountProjectToken(projectId)}#${workModule.anchor}`);
}

export async function saveTrialProjectsAction() {
  const session = await getCustomerSession();
  if (!session) throw new Error("请先登录");
  const count = await claimTrialProjects(getDb(), await trialProjectTokens(), session.user.id);
  await clearTrialProjects();
  return count;
}

export async function signOutAction() {
  await getCustomerAuth().api.signOut({ headers: await headers() });
  redirect("/");
}

export async function saveTrialProjectsAndReturnAction() {
  await saveTrialProjectsAction();
  redirect("/account");
}
