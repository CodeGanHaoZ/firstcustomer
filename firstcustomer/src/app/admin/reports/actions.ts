"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { enqueueCompanyReport } from "@/jobs/queue";
import { requireAdmin } from "@/lib/auth";
import { decideWeekly, requestCompanyReport } from "@/workflow/company-reports";

export async function createWeeklyReport() {
  await requireAdmin("company.manage", "/admin/reports");
  try {
    await requestCompanyReport(getDb(), enqueueCompanyReport, "weekly");
  } catch (error) {
    redirect(`/admin/reports?error=${encodeURIComponent(error instanceof Error ? error.message : "生成失败")}`);
  }
  revalidatePath("/admin/reports");
  redirect("/admin/reports");
}

export async function createStandupReport() {
  await requireAdmin("company.manage", "/admin/reports");
  try {
    await requestCompanyReport(getDb(), enqueueCompanyReport, "standup");
  } catch (error) {
    redirect(`/admin/reports?error=${encodeURIComponent(error instanceof Error ? error.message : "生成失败")}`);
  }
  revalidatePath("/admin");
  redirect("/admin#standup");
}

export async function weeklyDecisionAction(reportId: string, formData: FormData) {
  await requireAdmin("company.manage", "/admin/reports");
  try {
    const choice = z.enum(["continue", "pricing", "trim"]).parse(formData.get("choice"));
    await decideWeekly(getDb(), z.uuid().parse(reportId), choice, String(formData.get("note") ?? "").slice(0, 1000));
  } catch (error) {
    redirect(`/admin/reports?error=${encodeURIComponent(error instanceof Error ? error.message : "保存失败")}`);
  }
  revalidatePath("/admin/reports");
  redirect(`/admin/reports?report=${reportId}`);
}
