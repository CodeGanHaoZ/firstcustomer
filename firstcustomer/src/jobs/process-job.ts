import { createLiveSources } from "@/agents/sources";
import { createModelClient } from "@/ai/call-model";
import { createStubSources } from "@/ai/stub-model";
import type { Db } from "@/db";
import { requestCompanyReport, runCompanyReport } from "@/workflow/company-reports";
import { advanceProject, type EngineDeps } from "@/workflow/engine";
import type { WorkJob } from "./queue";

export function createJobProcessor(db: Db, enqueue: EngineDeps["enqueue"], enqueueReport: (id: string) => Promise<void>) {
  const model = createModelClient();
  const deps: EngineDeps = {
    db,
    model,
    sources: process.env.LLM_PROVIDER === "stub" ? createStubSources() : createLiveSources(model),
    enqueue,
  };

  return async (data: WorkJob) => {
    if ("projectId" in data) await advanceProject(deps, data.projectId);
    else if ("reportId" in data) await runCompanyReport(db, model, data.reportId);
    else await requestCompanyReport(db, enqueueReport, "standup");
  };
}
