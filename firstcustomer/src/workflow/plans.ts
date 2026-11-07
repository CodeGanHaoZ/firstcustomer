import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { orders, projects } from "@/db/schema";
import { canStartFreeDiagnosis } from "@/domain/workflow";
import { enqueueAdvance } from "@/jobs/queue";
import { projectOrder } from "./commerce";
import { transition } from "./transitions";

export async function startFreeDiagnosis(db: Db, projectId: string) {
  await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    if (project.productPlan === "free" && ["researching", "free_ready"].includes(project.status)) return;
    const order = await projectOrder(tx, projectId);
    if (!canStartFreeDiagnosis(project, order)) throw new Error("此项目当前无法开始免费初诊");
    await transition(tx, project, "researching", "customer", "客户开始免费初诊", {
      productPlan: "free", failedFrom: null, failedReason: null,
    });
    await enqueueAdvance(project.id, tx);
  });
}

export async function requestPro(db: Db, projectId: string) {
  await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    if (project.productPlan === "pro") return;
    if (project.productPlan !== "free" || project.status !== "free_ready" || project.paused) {
      throw new Error("免费初诊完成后可申请 Pro");
    }
    const order = await projectOrder(tx, projectId);
    if (order) {
      await tx.update(orders).set({ sku: "首客 Pro" }).where(eq(orders.id, order.id));
    } else {
      await tx.insert(orders).values({ projectId, sku: "首客 Pro" });
    }
    await transition(tx, project, "drafting_quote", "customer", "客户申请升级 Pro", {
      productPlan: "pro", requiresPayment: true,
    });
    await enqueueAdvance(project.id, tx);
  });
}
