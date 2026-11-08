import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { projects } from "@/db/schema";
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
    if (!canStartFreeDiagnosis(project, order)) throw new Error("此项目当前无法免费分析出海机会");
    await transition(tx, project, "researching", "customer", "客户启动免费出海机会分析", {
      productPlan: "free", failedFrom: null, failedReason: null,
    });
    await enqueueAdvance(project.id, tx);
  });
}
