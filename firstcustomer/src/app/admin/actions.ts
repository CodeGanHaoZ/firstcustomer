"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pageContent } from "@/agents/schemas";
import { getDb } from "@/db";
import { leads, projects } from "@/db/schema";
import { enqueueAdvance } from "@/jobs/queue";
import { endAdminSession, passwordMatches, requireAdmin, startAdminSession } from "@/lib/auth";
import { withinLimit } from "@/lib/request";
import { readUploadedFiles, readUploadedImage } from "@/lib/uploads";
import { confirmReceipt, decideQuote, MAX_AMOUNT_FEN, savePaymentCode, uploadReceipt } from "@/workflow/commerce";
import {
  addManualEvidence,
  addProjectImage,
  answerClarifications,
  cancelProject,
  decide,
  deleteProjectImage,
  deliverProject,
  markCampaignExecuted,
  recordFeedback,
  recordPayment,
  regenerateProjectLink,
  resolveEscalation,
  retryFailedImages,
  retryProject,
  setFounderMinutes,
  setOwnProduct,
  setPaused,
  setLeadTest,
  setQuote,
  skipClarifications,
  startResearch,
  startReview,
} from "@/workflow/actions";
import { replyToSupport } from "@/workflow/support";
import { editLandingPage } from "@/workflow/landing-edits";

export async function loginAction(formData: FormData) {
  const allowed = await withinLimit("admin-login", 10, 600);
  if (!allowed || !passwordMatches(String(formData.get("password") ?? ""))) {
    redirect("/admin/login?error=1");
  }
  await startAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/login");
}

type Handler = (formData: FormData, projectId: string) => Promise<string | void>;

// 所有经营台操作都先验证登录，失败时把原因带回页面。
function adminAction(handler: Handler) {
  return async (projectId: string, formData: FormData) => {
    await requireAdmin();
    const page = `/admin/projects/${projectId}`;
    let notice: string | void;
    try {
      notice = await handler(formData, projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败";
      redirect(`${page}?error=${encodeURIComponent(message)}`);
    }
    revalidatePath(page);
    redirect(notice ? `${page}?notice=${encodeURIComponent(notice)}` : page);
  };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const yuanToFen = (value: string) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("金额不正确，请精确到分");
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount * 100 > MAX_AMOUNT_FEN) throw new Error("金额不正确");
  return Math.round(amount * 100);
};

const founderDecisionHandler = adminAction(async (formData, projectId) => {
  const input = z
    .object({
      gate: z.enum(["positioning", "publish", "next_round"]),
      verdict: z.enum(["approve", "reject"]),
      version: z.coerce.number().int().positive(),
    })
    .parse(Object.fromEntries(formData));
  const option = text(formData, "chosenOption");
  await decide(getDb(), enqueueAdvance, {
    ...input,
    projectId,
    actor: "founder",
    reason: text(formData, "reason") || null,
    chosenOption: option === "" ? null : Number(option),
  });
});
export async function founderDecision(projectId: string, formData: FormData) {
  return founderDecisionHandler(projectId, formData);
}

// 自有产品没有外部客户，老板代为记录第二道确认，记录上仍是两道。
const ownProductConfirmHandler = adminAction(async (formData, projectId) => {
  const gate = z.enum(["positioning", "publish", "next_round"]).parse(formData.get("gate"));
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project?.isOwnProduct) throw new Error("只有自有产品才能由老板代为确认");
  const version = z.coerce.number().int().positive().parse(formData.get("version"));
  await decide(db, enqueueAdvance, { projectId, gate, version, actor: "customer", verdict: "approve" });
});
export async function ownProductConfirm(projectId: string, formData: FormData) {
  return ownProductConfirmHandler(projectId, formData);
}

const startResearchHandler = adminAction(async (_formData, projectId) => {
  await startResearch(getDb(), enqueueAdvance, projectId);
});
export async function startResearchAction(projectId: string, formData: FormData) {
  return startResearchHandler(projectId, formData);
}

const startReviewHandler = adminAction(async (_formData, projectId) => {
  await startReview(getDb(), enqueueAdvance, projectId);
});
export async function startReviewAction(projectId: string, formData: FormData) {
  return startReviewHandler(projectId, formData);
}

const deliverHandler = adminAction(async (_formData, projectId) => {
  await deliverProject(getDb(), projectId);
});
export async function deliverAction(projectId: string, formData: FormData) {
  return deliverHandler(projectId, formData);
}

const retryHandler = adminAction(async (_formData, projectId) => {
  await retryProject(getDb(), enqueueAdvance, projectId);
});
export async function retryAction(projectId: string, formData: FormData) {
  return retryHandler(projectId, formData);
}

const cancelHandler = adminAction(async (_formData, projectId) => {
  await cancelProject(getDb(), projectId);
});
export async function cancelAction(projectId: string, formData: FormData) {
  return cancelHandler(projectId, formData);
}

const escalationHandler = adminAction(async (formData, projectId) => {
  await resolveEscalation(getDb(), enqueueAdvance, {
    projectId,
    target: z.enum(["researching", "strategizing", "preparing_page"]).parse(formData.get("target")),
    note: text(formData, "note"),
  });
});
export async function escalationAction(projectId: string, formData: FormData) {
  return escalationHandler(projectId, formData);
}

const regenerateHandler = adminAction(async (_formData, projectId) => {
  const token = await regenerateProjectLink(getDb(), projectId);
  return `新的项目链接（只显示这一次）：/p/${token}`;
});
export async function regenerateLinkAction(projectId: string, formData: FormData) {
  return regenerateHandler(projectId, formData);
}

const campaignHandler = adminAction(async (formData) => {
  await markCampaignExecuted(getDb(), text(formData, "campaignId"), text(formData, "url"));
});
export async function campaignExecutedAction(projectId: string, formData: FormData) {
  return campaignHandler(projectId, formData);
}

const feedbackHandler = adminAction(async (formData) => {
  const body = text(formData, "text");
  if (!body) throw new Error("请填写回复内容");
  await recordFeedback(getDb(), {
    landingPageId: text(formData, "landingPageId"),
    type: z.enum(["reply", "comment"]).parse(formData.get("type")),
    text: body,
    url: text(formData, "url") || null,
  });
});
export async function feedbackAction(projectId: string, formData: FormData) {
  return feedbackHandler(projectId, formData);
}

const quoteHandler = adminAction(async (formData, projectId) => {
  await setQuote(getDb(), projectId, yuanToFen(text(formData, "yuan")));
});
export async function quoteAction(projectId: string, formData: FormData) {
  return quoteHandler(projectId, formData);
}

const paymentHandler = adminAction(async (formData, projectId) => {
  await recordPayment(getDb(), projectId, {
    amountFen: yuanToFen(text(formData, "yuan")),
    method: text(formData, "method") || "人工记录",
    reference: text(formData, "reference") || null,
  });
});
export async function paymentAction(projectId: string, formData: FormData) {
  return paymentHandler(projectId, formData);
}

const minutesHandler = adminAction(async (formData, projectId) => {
  await setFounderMinutes(getDb(), projectId, Math.max(0, Number(text(formData, "minutes")) || 0));
});
export async function minutesAction(projectId: string, formData: FormData) {
  return minutesHandler(projectId, formData);
}

const proposalHandler = adminAction(async (formData, projectId) => {
  const verdict = z.enum(["approve", "reject"]).parse(formData.get("verdict"));
  await decideQuote(getDb(), enqueueAdvance, {
    projectId,
    actor: "founder",
    version: z.coerce.number().int().positive().parse(formData.get("version")),
    verdict,
    reason: text(formData, "reason").slice(0, 500),
    quoteFen: verdict === "approve" ? yuanToFen(text(formData, "yuan")) : undefined,
  });
});
export async function founderProposalAction(projectId: string, formData: FormData) {
  return proposalHandler(projectId, formData);
}

const receiptUploadHandler = adminAction(async (formData, projectId) => {
  await uploadReceipt(getDb(), enqueueAdvance, { projectId, bytes: await readUploadedImage(formData, "receipt"), actor: "founder" });
});
export async function founderReceiptUploadAction(projectId: string, formData: FormData) {
  return receiptUploadHandler(projectId, formData);
}

const receiptConfirmationHandler = adminAction(async (formData, projectId) => {
  await confirmReceipt(getDb(), enqueueAdvance, {
    projectId,
    receiptId: z.uuid().parse(formData.get("receiptId")),
    amountFen: yuanToFen(text(formData, "yuan")),
    reference: text(formData, "reference").slice(0, 200),
    reason: text(formData, "reason").slice(0, 500),
  });
});
export async function confirmReceiptAction(projectId: string, formData: FormData) {
  return receiptConfirmationHandler(projectId, formData);
}

const pauseHandler = adminAction(async (formData, projectId) => {
  const paused = z.enum(["1", "0"]).parse(formData.get("paused")) === "1";
  await setPaused(getDb(), enqueueAdvance, projectId, paused);
});
export async function pauseProjectAction(projectId: string, formData: FormData) {
  return pauseHandler(projectId, formData);
}

const markTestLeadHandler = adminAction(async (formData, projectId) => {
  await setLeadTest(getDb(), projectId, z.uuid().parse(formData.get("leadId")), formData.get("test") === "1");
});
export async function markTestLeadAction(projectId: string, formData: FormData) {
  return markTestLeadHandler(projectId, formData);
}

const landingEditHandler = adminAction(async (formData, projectId) => {
  const rows = (key: string) => text(formData, key).slice(0, 3000).split("\n").map((value) => value.trim()).filter(Boolean);
  const field = (key: string) => z.string().min(1).max(600).parse(text(formData, key));
  const claim = text(formData, "claim");
  await editLandingPage(getDb(), {
    projectId,
    version: z.coerce.number().int().positive().parse(formData.get("version")),
    image: z.union([z.literal("none"), z.literal("keep"), z.uuid()]).parse(formData.get("image")),
    content: pageContent.parse({
      headline: field("headline"), subheadline: field("subheadline"), value_props: rows("value_props"),
      scenarios: rows("scenarios"), cta_label: field("cta_label"), form_prompt: field("form_prompt"),
    }),
    claim: claim ? {
      text: z.string().max(600).parse(claim), location: "page",
      kind: z.enum(["metric", "comparison", "pain", "feature"]).parse(formData.get("claim_kind")),
      evidence_id: z.uuid().parse(formData.get("evidence_id")),
    } : null,
  });
  return "新版本已通过声明检查，等待老板和客户重新审批";
});
export async function editLandingAction(projectId: string, formData: FormData) {
  return landingEditHandler(projectId, formData);
}

const supportReplyHandler = adminAction(async (formData, projectId) => {
  await replyToSupport(getDb(), projectId, z.uuid().parse(formData.get("messageId")), text(formData, "reply"));
});
export async function replyToSupportAction(projectId: string, formData: FormData) {
  return supportReplyHandler(projectId, formData);
}

export async function uploadPaymentCodeAction(formData: FormData) {
  await requireAdmin();
  try {
    await savePaymentCode(getDb(), await readUploadedImage(formData, "paymentCode"));
  } catch (error) {
    redirect(`/admin/payment?error=${encodeURIComponent(error instanceof Error ? error.message : "上传失败")}`);
  }
  revalidatePath("/admin/payment");
  redirect("/admin/payment?saved=1");
}

const evidenceHandler = adminAction(async (formData, projectId) => {
  await addManualEvidence(getDb(), {
    projectId,
    url: text(formData, "url"),
    quote: text(formData, "quote"),
    sourceText: text(formData, "sourceText"),
    kind: z.enum(["pain", "pricing", "revenue", "signal", "channel", "product"]).parse(formData.get("kind")),
    stance: z.enum(["support", "against", "neutral"]).parse(formData.get("stance")),
    product: text(formData, "product") || null,
    numberValue: text(formData, "numberValue") || null,
    metric: text(formData, "metric") || null,
    customerAuthorized: formData.get("customerAuthorized") === "on",
  });
});
export async function manualEvidenceAction(projectId: string, formData: FormData) {
  return evidenceHandler(projectId, formData);
}

const founderAnswersHandler = adminAction(async (formData, projectId) => {
  const answers: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (key.startsWith("answer_") && typeof value === "string") {
      answers[key.slice("answer_".length)] = value;
    }
  }
  const result = await answerClarifications(getDb(), enqueueAdvance, {
    projectId,
    answers,
    by: "founder",
  });
  if (!result.complete) return `已保存，还有 ${result.remaining} 个问题没有回答`;
});
export async function founderAnswersAction(projectId: string, formData: FormData) {
  return founderAnswersHandler(projectId, formData);
}

const skipClarificationsHandler = adminAction(async (_formData, projectId) => {
  await skipClarifications(getDb(), enqueueAdvance, projectId);
});
export async function skipClarificationsAction(projectId: string, formData: FormData) {
  return skipClarificationsHandler(projectId, formData);
}

const ownProductHandler = adminAction(async (formData, projectId) => {
  await setOwnProduct(getDb(), projectId, formData.get("value") === "1");
});
export async function ownProductAction(projectId: string, formData: FormData) {
  return ownProductHandler(projectId, formData);
}

const uploadImagesHandler = adminAction(async (formData, projectId) => {
  const kind = z.enum(["product", "competitor"]).parse(formData.get("kind"));
  const note = text(formData, "note").slice(0, 200);
  for (const bytes of await readUploadedFiles(formData, "images")) {
    await addProjectImage(getDb(), { projectId, bytes, kind, note, uploadedBy: "founder" });
  }
});
export async function adminUploadImagesAction(projectId: string, formData: FormData) {
  return uploadImagesHandler(projectId, formData);
}

const deleteImageHandler = adminAction(async (formData, projectId) => {
  await deleteProjectImage(getDb(), projectId, z.uuid().parse(formData.get("imageId")));
});
export async function adminDeleteImageAction(projectId: string, formData: FormData) {
  return deleteImageHandler(projectId, formData);
}

const retryImagesHandler = adminAction(async (_formData, projectId) => {
  await retryFailedImages(getDb(), projectId);
});
export async function retryImagesAction(projectId: string, formData: FormData) {
  return retryImagesHandler(projectId, formData);
}

const deleteLeadHandler = adminAction(async (formData) => {
  await getDb().delete(leads).where(eq(leads.id, text(formData, "leadId")));
});
export async function deleteLeadAction(projectId: string, formData: FormData) {
  return deleteLeadHandler(projectId, formData);
}
