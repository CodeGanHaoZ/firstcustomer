"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { enqueueAdvance } from "@/jobs/queue";
import { findCustomerProject, requireCustomerProjectSession } from "@/lib/customer-project";
import { withinLimit } from "@/lib/request";
import { readUploadedFiles, readUploadedImage } from "@/lib/uploads";
import { uploadReceipt } from "@/workflow/commerce";
import {
  addProjectImage,
  acceptDelivery,
  answerClarifications,
  decide,
  deleteProjectImage,
  startReview,
  startPurchasedProRound,
  deliverProject,
} from "@/workflow/actions";
import { openSupportMessage } from "@/workflow/support";
import { startFreeDiagnosis } from "@/workflow/plans";
import { completeProPurchase, createProPurchase } from "@/workflow/purchases";
import { reviseRequirements } from "@/workflow/requirements";
import { requirementFields } from "@/domain/requirements";
import { activateProByKey } from "@/workflow/pro-access";
import { getCustomerSession } from "@/lib/customer-auth";
import { claimTrialProjects, rememberTrialProject } from "@/lib/trial-projects";
import { ensureProTrialVisitor } from "@/lib/pro-trial-visitor";
import { claimGuestProTrial, claimProTrial } from "@/workflow/purchases";

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
  await requireCustomerProjectSession(token);
  const db = getDb();
  const project = await findCustomerProject(db, token);
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
      version: z.coerce.number().int().positive().parse(formData.get("requirementVersion")),
    });
    if (!result.complete) return `已保存，还有 ${result.remaining} 个问题没有回答`;
  });
}

export async function customerStartFreeAction(token: string) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("free-diagnosis", 8, 3600))) throw new Error("提交太频繁，请稍后重试");
    await startFreeDiagnosis(getDb(), projectId);
  });
}

export async function customerClaimTrialAction(token: string) {
  const session = await getCustomerSession();
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("pro-trial-claim", 8, 3600))) throw new Error("领取请求过于频繁，请稍后重试");
    const guestHash = await ensureProTrialVisitor();
    if (session) await claimTrialProjects(getDb(), [token], session.user.id);
    else await rememberTrialProject(token);
    const claimed = session ? await claimProTrial(getDb(), session.user.id, projectId, enqueueAdvance, guestHash)
      : await claimGuestProTrial(getDb(), guestHash, projectId);
    revalidatePath("/account"); revalidatePath("/account/pro");
    return claimed ? "免费试用已开通，正在开始本轮完整验证。" : "本项目免费试用已开通，无需重复领取。";
  });
}

export async function customerPurchaseProAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("pro-purchase", 12, 3600))) throw new Error("提交过于频繁，请稍后重试");
    await createProPurchase(getDb(), projectId, z.string().regex(/^[a-f0-9]{64}$/).parse(formData.get("quoteFingerprint")));
    return "报价已确认，请完成付款以开通本项目 Pro。";
  });
}

export async function customerPayProAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("pro-payment", 12, 3600))) throw new Error("提交过于频繁，请稍后重试");
    const activated = await completeProPurchase(getDb(), projectId, z.uuid().parse(formData.get("paymentId")),
      z.string().regex(/^[a-f0-9]{64}$/).parse(formData.get("quoteFingerprint")));
    for (const path of ["/admin", "/admin/owner", "/account", "/account/pro", `/admin/projects/${projectId}`]) revalidatePath(path);
    return activated ? "付款成功，本项目 Pro 已开通，团队已开始执行。" : "本项目 Pro 已开通，无需重复付款。";
  });
}

export async function customerStartReviewAction(token: string) {
  await withProject(token, async (projectId) => { await startReview(getDb(), enqueueAdvance, projectId, "customer"); });
}

export async function customerNextRoundAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("pro-next-round", 12, 3600))) throw new Error("提交过于频繁，请稍后重试");
    await startPurchasedProRound(getDb(), enqueueAdvance, {
      projectId, round: z.coerce.number().int().positive().parse(formData.get("round")),
      focus: z.string().max(500).parse(String(formData.get("focus") ?? "")),
    });
    revalidatePath("/account"); revalidatePath(`/admin/projects/${projectId}`);
    return "套餐内下一轮已启动，无需再次付款。";
  });
}

export async function customerCompleteProjectAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    await deliverProject(getDb(), projectId, z.string().regex(/^[a-f0-9]{64}$/).parse(formData.get("deliveryStamp")), "customer");
    return "本轮交付已完成，你可以核对交付清单并确认验收。";
  });
}

export async function customerActivateProAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("pro-key", 5, 900))) throw new Error("密钥尝试过于频繁，请 15 分钟后再试。");
    const activated = await activateProByKey(getDb(), projectId, formData.get("proKey"));
    revalidatePath("/admin");
    revalidatePath(`/admin/projects/${projectId}`);
    return activated ? "Pro 已通过密钥开通，正在开始制定策略。" : "当前项目已开通 Pro，无需重复开通。";
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
      stamp: z.string().regex(/^[a-f0-9]{64}$/).parse(formData.get("deliveryStamp")),
    });
  });
}

export async function customerRequirementsAction(token: string, formData: FormData) {
  await withProject(token, async (projectId) => {
    if (!(await withinLimit("requirements-revise", 4, 3600))) throw new Error("修订太频繁，请稍后重试");
    const version = z.coerce.number().int().positive().parse(formData.get("version"));
    const saved = await reviseRequirements(getDb(), enqueueAdvance, { projectId,
      version,
      fields: requirementFields.parse(Object.fromEntries(formData)),
    });
    if (saved.requirementVersion === version) return "需求内容没有变化，继续使用当前版本。";
    return "新需求版本已保存，正在重新分析出海机会；历史资料可在需求卡中查看。";
  });
}

export async function customerDecision(token: string, formData: FormData) {
  await requireCustomerProjectSession(token);
  const db = getDb();
  const project = await findCustomerProject(db, token);
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
