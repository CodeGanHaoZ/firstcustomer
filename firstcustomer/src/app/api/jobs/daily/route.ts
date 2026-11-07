import { getDb } from "@/db";
import { ADVANCE_QUEUE, enqueueCompanyReport, getBoss, publishJobWake } from "@/jobs/queue";
import { requestCompanyReport } from "@/workflow/company-reports";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }
  const boss = await getBoss();
  await boss.supervise(ADVANCE_QUEUE, { reindex: false });
  const waiting = await boss.findJobs(ADVANCE_QUEUE, { queued: true, limit: 100 });
  const today = new Date().toISOString().slice(0, 10);
  await Promise.all(waiting.map(({ id }) => publishJobWake(id, today)));
  await requestCompanyReport(getDb(), enqueueCompanyReport, "standup");
  return new Response(null, { status: 204 });
}
