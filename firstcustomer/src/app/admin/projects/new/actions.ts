"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { NEW_CUSTOMER_LINK_COOKIE, requireAdmin } from "@/lib/auth";
import { submitProject } from "@/workflow/intake";

export async function createFounderProjectAction(formData: FormData) {
  await requireAdmin("projects.manage", "/admin/projects/new");
  const { projectId, token, imageWarning } = await submitProject(getDb(), formData, true).catch((error: unknown) => {
    redirect(`/admin/projects/new?error=${encodeURIComponent(error instanceof Error ? error.message : "提交失败")}`);
  });
  const path = `/admin/projects/${projectId}`;
  (await cookies()).set(NEW_CUSTOMER_LINK_COOKIE, token, {
    path,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production",
    maxAge: 600,
  });
  const query = new URLSearchParams({ created: "1" });
  if (imageWarning) query.set("error", imageWarning);
  redirect(`${path}?${query}`);
}
