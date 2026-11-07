"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { seedKnowledge } from "@/knowledge/seed";
import { saveKnowledge, withdrawKnowledge } from "@/knowledge/store";
import { knowledgeContentSchema } from "@/knowledge/validation";

function readableError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "请检查填写内容";
  if (error instanceof Error && error.message.startsWith("资料已")) return error.message;
  return "暂时无法保存，请稍后重试。填写的内容仍保留在页面中。";
}

export async function saveKnowledgeAction(_state: { error: string }, formData: FormData) {
  await requireAdmin();
  let id: string;
  let publish: boolean;
  try {
    const intent = z.enum(["draft", "publish"]).parse(formData.get("intent"));
    publish = intent === "publish";
    const content = knowledgeContentSchema.parse({
      ...Object.fromEntries(formData), agents: formData.getAll("agents"),
    });
    const existingId = String(formData.get("id") ?? "");
    const saved = await saveKnowledge(getDb(), {
      id: existingId || undefined,
      revision: z.coerce.number().int().positive().parse(formData.get("revision")),
      content, publish,
    });
    id = saved.id;
  } catch (error) {
    return { error: readableError(error) };
  }
  revalidatePath("/admin/knowledge");
  redirect(`/admin/knowledge/${id}?saved=${publish ? "published" : "draft"}`);
}

export async function withdrawKnowledgeAction(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));
  try {
    const revision = z.coerce.number().int().positive().parse(formData.get("revision"));
    await withdrawKnowledge(getDb(), id, revision);
  } catch (error) {
    redirect(`/admin/knowledge/${id}?error=${encodeURIComponent(readableError(error))}`);
  }
  revalidatePath("/admin/knowledge");
  redirect(`/admin/knowledge/${id}?saved=withdrawn`);
}

export async function initializeKnowledgeAction() {
  await requireAdmin();
  let added: number;
  try { added = await seedKnowledge(getDb()); }
  catch { redirect("/admin/knowledge?error=初始化失败，请稍后重试"); }
  revalidatePath("/admin/knowledge");
  redirect(`/admin/knowledge?initialized=${added}`);
}
