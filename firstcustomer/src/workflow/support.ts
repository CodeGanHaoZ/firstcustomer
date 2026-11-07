import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { decisions, projects, supportMessages } from "@/db/schema";

const ESCALATE = /退款|退费|退钱|投诉|举报|起诉|诉讼|律师|赔偿|保证.{0,8}(获客|效果|收益|盈利|上线|销量)|承诺.{0,8}(效果|盈利|时间|上线)|(?:refund|complaint|lawsuit|lawyer|guarantee)/iu;

export function needsFounder(text: string) {
  return ESCALATE.test(text);
}

export async function openSupportMessage(
  db: Db, enqueue: (id: string) => Promise<void>, projectId: string, question: string,
) {
  question = question.trim();
  if (!question || question.length > 1000) throw new Error("请输入 1 到 1000 字的问题");
  await db.transaction(async (tx) => {
    const [project] = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    const [recent] = await tx.select({ total: count() }).from(supportMessages)
      .where(and(eq(supportMessages.projectId, projectId), gt(supportMessages.createdAt, new Date(Date.now() - 86_400_000))));
    if (recent.total >= 10) throw new Error("这个项目今天已提交 10 个问题，请明天再试");
    const highRisk = needsFounder(question);
    await tx.insert(supportMessages).values({
      projectId, question,
      ...(highRisk ? { risk: "escalated", status: "escalated", draft: "请核对订单、交付记录和客户诉求后，由老板决定回复。" } : {}),
    });
  });
  if (!needsFounder(question)) await enqueue(projectId);
}

export function projectSupport(db: Db, projectId: string) {
  return db.select().from(supportMessages).where(eq(supportMessages.projectId, projectId))
    .orderBy(desc(supportMessages.createdAt)).limit(40);
}

export async function replyToSupport(db: Db, projectId: string, messageId: string, reply: string) {
  reply = reply.trim();
  if (!reply || reply.length > 1200) throw new Error("请输入 1 到 1200 字的回复");
  await db.transaction(async (tx) => {
    const [changed] = await tx.update(supportMessages)
      .set({ status: "resolved", reply, updatedAt: new Date() })
      .where(and(eq(supportMessages.projectId, projectId), eq(supportMessages.id, messageId),
        inArray(supportMessages.status, ["escalated", "replied"])))
      .returning({ id: supportMessages.id });
    if (!changed) throw new Error("该问题已处理或不存在");
    await tx.insert(decisions).values({
      projectId, subjectId: changed.id, gate: "support", subjectVersion: 1,
      actorRole: "founder", verdict: "approve", reason: "老板核对并回复客户问题",
      snapshot: { messageId: changed.id, reply },
    });
  });
}
