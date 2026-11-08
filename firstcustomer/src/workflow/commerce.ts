import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { decisions, orders, paymentCode, paymentReceipts, payments, projects } from "@/db/schema";
import type { ActorRole } from "@/domain/approval";
import { detectImageType, imageError } from "@/domain/images";
import { usesQuoteFlow } from "@/domain/workflow";
import { transition } from "./transitions";

export const MAX_AMOUNT_FEN = 2_147_483_647;

export async function projectOrder(db: Db, projectId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.projectId, projectId)).limit(1);
  return order ?? null;
}

export async function confirmedOrderPayment(db: Db, orderId: string) {
  const [payment] = await db.select({ amountFen: payments.amountFen, paidAt: payments.paidAt }).from(payments)
    .where(eq(payments.orderId, orderId)).orderBy(desc(payments.paidAt), desc(payments.id)).limit(1);
  return payment ?? null;
}

async function lockOrder(db: Db, projectId: string) {
  // Serialize decisions, uploads and payment confirmation per project.
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).for("update");
  if (!project || !usesQuoteFlow(project)) throw new Error("此项目没有在线报价流程");
  const order = await projectOrder(db, projectId);
  if (!order) throw new Error("项目没有订单");
  return { project, order };
}

export async function savePaymentCode(db: Db, bytes: Uint8Array) {
  const image = imageData(bytes);
  await db.insert(paymentCode).values({ id: 1, ...image }).onConflictDoUpdate({
    target: paymentCode.id,
    set: image,
  });
}

export async function hasPaymentCode(db: Db) {
  const [row] = await db.select({ id: paymentCode.id }).from(paymentCode).where(eq(paymentCode.id, 1));
  return !!row;
}

export async function customerPaymentCode(db: Db, projectId: string) {
  const [image] = await db.select({ mimeType: paymentCode.mimeType, data: paymentCode.data })
    .from(paymentCode)
    .innerJoin(projects, and(eq(projects.id, projectId),
      inArray(projects.status, ["awaiting_payment", "reading_receipt"])))
    .innerJoin(orders, and(eq(orders.projectId, projects.id), eq(orders.status, "accepted")))
    .where(eq(paymentCode.id, 1));
  return image ?? null;
}

const receiptSummary = {
  id: paymentReceipts.id,
  analysisStatus: paymentReceipts.analysisStatus,
  analysis: paymentReceipts.analysis,
  createdAt: paymentReceipts.createdAt,
};

export async function latestReceipt(db: Db, orderId: string) {
  const [receipt] = await db.select(receiptSummary).from(paymentReceipts)
    .where(eq(paymentReceipts.orderId, orderId))
    .orderBy(desc(paymentReceipts.createdAt), desc(paymentReceipts.id))
    .limit(1);
  return receipt ?? null;
}

export async function loadReceiptImage(db: Db, projectId: string, receiptId: string) {
  const [image] = await db.select({ mimeType: paymentReceipts.mimeType, data: paymentReceipts.data })
    .from(paymentReceipts)
    .innerJoin(orders, eq(orders.id, paymentReceipts.orderId))
    .where(and(eq(orders.projectId, projectId), eq(paymentReceipts.id, receiptId)));
  return image ?? null;
}

export async function uploadReceipt(
  db: Db,
  enqueue: (projectId: string) => Promise<void>,
  input: { projectId: string; bytes: Uint8Array; actor: ActorRole },
) {
  const image = imageData(input.bytes);
  await db.transaction(async (tx) => {
    const { project, order } = await lockOrder(tx, input.projectId);
    if (project.paused) throw new Error("项目已暂停，请恢复后再上传付款截图");
    if (project.status !== "awaiting_payment" || order.status !== "accepted") {
      throw new Error("接受报价后才能上传付款截图，请等待当前任务完成");
    }
    await tx.insert(paymentReceipts).values({ orderId: order.id, uploadedBy: input.actor, ...image });
    await transition(tx, project, "reading_receipt", input.actor, "上传付款截图");
  });
  await enqueue(input.projectId);
}

export async function confirmReceipt(
  db: Db,
  enqueue: (projectId: string) => Promise<void>,
  input: { projectId: string; receiptId: string; amountFen: number; reference?: string; reason?: string },
) {
  assertPositiveAmount(input.amountFen);
  await db.transaction(async (tx) => {
    const { project, order } = await lockOrder(tx, input.projectId);
    if (project.paused) throw new Error("项目已暂停，请恢复后再确认到账");
    if (project.status !== "awaiting_payment" || order.status !== "accepted") {
      throw new Error("项目当前不在待确认到账状态");
    }
    const receipt = await latestReceipt(tx, order.id);
    if (!receipt || receipt.id !== input.receiptId || receipt.analysisStatus === "pending") {
      throw new Error("请刷新并核对最新一张付款截图");
    }
    const reason = input.reason?.trim();
    if (input.amountFen !== order.quoteFen && !reason) throw new Error("实收与报价不一致，请写明原因");
    const [payment] = await tx.insert(payments).values({
      orderId: order.id,
      amountFen: input.amountFen,
      method: "收款码 · 老板核对",
      reference: input.reference?.trim() || null,
    }).returning({ id: payments.id });
    await tx.update(orders).set({ status: "paid" }).where(eq(orders.id, order.id));
    await tx.insert(decisions).values({
      projectId: project.id,
      gate: "payment",
      subjectVersion: order.quoteVersion,
      actorRole: "founder",
      verdict: "approve",
      snapshot: { orderId: order.id, paymentId: payment.id, receiptId: receipt.id,
        quoteVersion: order.quoteVersion, quoteFen: order.quoteFen, amountFen: input.amountFen,
        reference: input.reference?.trim() || null },
      reason: reason || "已核对实际到账",
    });
    await transition(tx, project, "strategizing", "founder", "老板确认到账，开始正式服务");
  });
  await enqueue(input.projectId);
}

function imageData(bytes: Uint8Array) {
  const problem = imageError(bytes, 0);
  if (problem) throw new Error(problem);
  return { mimeType: detectImageType(bytes)!, data: Buffer.from(bytes) };
}

function assertPositiveAmount(amount: number | undefined) {
  if (amount === undefined || !Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT_FEN) {
    throw new Error("请填写正确的金额（精确到分）");
  }
}
