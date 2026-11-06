"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { safeHref, withinLimit } from "@/lib/request";
import { readUploadedFiles } from "@/lib/uploads";
import { addProjectImage, createProject } from "@/workflow/actions";

const emptyToNull = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const schema = z.object({
  productName: z.string().trim().min(1).max(500),
  stage: z.enum(["没有产品", "有想法", "已有 MVP", "已上线"]),
  goal: z.enum(["找需求", "验证", "找首批用户", "提升转化"]),
  contact: z.string().trim().min(3).max(200),
});

export async function createProjectAction(formData: FormData) {
  if (emptyToNull(formData.get("website"))) redirect("/");
  if (!(await withinLimit("new-project", 5, 3600))) {
    redirect(`/projects/new?error=${encodeURIComponent("提交太频繁，请稍后再试")}`);
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/projects/new?error=${encodeURIComponent("请检查必填项")}`);
  }
  const db = getDb();
  const { project, token } = await createProject(db, {
    ...parsed.data,
    productUrl: safeHref(emptyToNull(formData.get("productUrl"))) ?? null,
    targetMarket: emptyToNull(formData.get("targetMarket")),
    budgetNote: emptyToNull(formData.get("budgetNote")),
  });
  // 截图有问题也先保留项目，不让客户重新填写。
  try {
    for (const bytes of await readUploadedFiles(formData, "screenshots")) {
      await addProjectImage(db, { projectId: project.id, bytes, kind: "product", uploadedBy: "customer" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "截图上传失败";
    redirect(`/p/${token}?error=${encodeURIComponent(`项目已保存，但截图没有全部上传：${message}`)}`);
  }
  redirect(`/p/${token}`);
}
