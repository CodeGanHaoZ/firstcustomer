import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { decisions, orders, projects } from "@/db/schema";
import { canActivateProByKey, hasProAccess } from "@/domain/workflow";
import { enqueueAdvance } from "@/jobs/queue";
import { assertProAccessKey } from "@/lib/pro-access-key";
import { projectOrder } from "./commerce";
import { transition } from "./transitions";

export async function activateProByKey(
  db: Db,
  projectId: string,
  key: unknown,
  enqueue: (projectId: string, transaction: Db) => Promise<void> = enqueueAdvance,
) {
  assertProAccessKey(key);
  return db.transaction(async (tx) => {
    // Serializes activation against repeat submissions, quote decisions and receipt confirmation.
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    const order = await projectOrder(tx, projectId);
    if (hasProAccess(project, order)) return false;
    if (!canActivateProByKey(project)) {
      throw new Error("请等待出海机会报告或当前报价、截图任务完成，并在项目恢复后开通 Pro。");
    }
    if (order) {
      await tx.update(orders).set({ status: "key_activated", sku: "首客 Pro" }).where(eq(orders.id, order.id));
    } else {
      await tx.insert(orders).values({ projectId, sku: "首客 Pro", status: "key_activated" });
    }
    await tx.insert(decisions).values({
      projectId, gate: "pro_access", subjectVersion: project.scopeVersion,
      actorRole: "customer", verdict: "approve", reason: "通过 Pro 密钥开通，免付款核验",
      snapshot: { method: "key", requirementVersion: project.requirementVersion, scopeVersion: project.scopeVersion },
    });
    await transition(tx, project, "strategizing", "customer", "通过密钥开通 Pro，开始制定策略", {
      productPlan: "pro", requiresPayment: false, proAccessSource: "key", failedFrom: null, failedReason: null,
    });
    // Grant and durable job are committed together; a queue failure rolls back the grant.
    await enqueue(projectId, tx);
    return true;
  });
}
