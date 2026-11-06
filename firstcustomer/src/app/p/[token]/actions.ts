"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { enqueueAdvance } from "@/jobs/queue";
import { withinLimit } from "@/lib/request";
import { readUploadedFiles, readUploadedImage } from "@/lib/uploads";
import { decideQuote, uploadReceipt } from "@/workflow/commerce";
import {
  addProjectImage,
  acceptDelivery,
  answerClarifications,
  decide,
  deleteProjectImage,
  findProjectByToken,
} from "@/workflow/actions";
import { openSupportMessage } from "@/workflow/support";

const schema = z.object({
  gate: z.enum(["positioning", "publish", "next_round"]),
  verdict: z.enum(["approve", "reject"]),
  version: z.coerce.number().int().positive(),
  reason: z.string().max(500).optional(),
});

async function withProject(
  token: string,
  run: (projectId: string) => Promise<string | void>,
) {
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const page = `/p/${token}`;
  let notice: string | void;
  try {
    notice = await run(project.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    redirect(`${page}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(page);
  redirect(notice ? `${page}?notice=${encodeURIComponent(notice)}` : page);
}

export async function customerAnswers(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    const answers: Record<string, string> = {};
    for (const [key, value] of formData) {
      if (key.startsWith("answer_") && typeof value === "string") {
        answers[key.slice("answer_".length)] = value;
      }
    }
    const result = await answerClarifications(getDb(), enqueueAdvance, {
      projectId,
      answers,
      by: "customer",
    });
    if (!result.complete) return `已保存，还有 ${result.remaining} 个问题没有回答`;
  });
}

export async function customerUploadImages(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("image-upload", 20, 3600))) {
      throw new Error("上传太频繁，请稍后再试");
    }
    const kind = z.enum(["product", "competitor"]).parse(formData.get("kind"));
    const note = String(formData.get("note") ?? "").trim().slice(0, 200);
    for (const bytes of await readUploadedFiles(formData, "images")) {
      await addProjectImage(getDb(), { projectId, bytes, kind, note, uploadedBy: "customer" });
    }
  });
}

export async function customerDeleteImage(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    await deleteProjectImage(getDb(), projectId, z.uuid().parse(formData.get("imageId")));
  });
}

export async function customerProposalAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    await decideQuote(getDb(), enqueueAdvance, {
      projectId,
      actor: "customer",
      version: z.coerce.number().int().positive().parse(formData.get("version")),
      verdict: z.enum(["approve", "reject"]).parse(formData.get("verdict")),
      reason: String(formData.get("reason") ?? "").slice(0, 500),
    });
  });
}

export async function customerReceiptAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("receipt-upload", 10, 3600))) throw new Error("上传太频繁，请稍后再试");
    await uploadReceipt(getDb(), enqueueAdvance, { projectId, bytes: await readUploadedImage(formData, "receipt"), actor: "customer" });
    return "付款截图已收到，请等待首客核对实际到账";
  });
}

export async function customerSupportAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("customer-support", 12, 3600))) throw new Error("提交过于频繁，请稍后再试");
    await openSupportMessage(getDb(), enqueueAdvance, projectId, String(formData.get("question") ?? ""));
  });
}

export async function customerAcceptanceAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    await acceptDelivery(getDb(), {
      projectId,
      verdict: z.enum(["approve", "reject"]).parse(formData.get("verdict")),
      reason: String(formData.get("reason") ?? "").trim().slice(0, 500),
    });
  });
}

export async function customerDecision(token: string, formData: FormData) {
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const input = schema.parse(Object.fromEntries(formData));
  const page = `/p/${token}`;
  try {
    await decide(db, enqueueAdvance, { ...input, projectId: project.id, actor: "customer" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    redirect(`${page}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(page);
  redirect(page);
}
