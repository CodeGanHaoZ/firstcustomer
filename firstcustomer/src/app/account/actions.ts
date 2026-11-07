"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerAuth, getCustomerSession } from "@/lib/customer-auth";
import { getDb } from "@/db";
import { claimTrialProjects, clearTrialProjects, trialProjectTokens } from "@/lib/trial-projects";

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
