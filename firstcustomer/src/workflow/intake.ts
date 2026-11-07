import { z } from "zod";
import type { Db } from "@/db";
import { safeHref } from "@/lib/request";
import { readUploadedFiles } from "@/lib/uploads";
import { addProjectImage, createProject } from "./actions";

const schema = z.object({
  productName: z.string().trim().min(1).max(500),
  stage: z.enum(["没有产品", "有想法", "已有 MVP", "已上线"]),
  goal: z.enum(["找需求", "验证", "找首批用户", "提升转化"]),
  contact: z.string().trim().min(3).max(200),
});
const optionalText = (value: FormDataEntryValue | null, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) || null : null;

export async function submitProject(db: Db, formData: FormData, founder = false, customerId?: string) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("请检查必填项");
  const { project, token } = await createProject(db, {
    ...parsed.data,
    customerId,
    productUrl: safeHref(optionalText(formData.get("productUrl"), 2048)) ?? null,
    targetMarket: optionalText(formData.get("targetMarket"), 200),
    budgetNote: optionalText(formData.get("budgetNote"), 200),
    currentWorkflow: optionalText(formData.get("currentWorkflow"), 1000) ?? "",
    successCriteria: optionalText(formData.get("successCriteria"), 1000) ?? "",
    constraints: optionalText(formData.get("constraints"), 1000) ?? "",
    isOwnProduct: founder && formData.get("own") === "1",
    productPlan: founder ? undefined : "free",
  });
  let imageWarning: string | null = null;
  try {
    for (const bytes of await readUploadedFiles(formData, "screenshots")) {
      await addProjectImage(db, { projectId: project.id, bytes, kind: "product", uploadedBy: founder ? "founder" : "customer" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "截图上传失败";
    imageWarning = `项目已保存，但截图没有全部上传。${message}`;
  }
  return { projectId: project.id, token, imageWarning };
}
