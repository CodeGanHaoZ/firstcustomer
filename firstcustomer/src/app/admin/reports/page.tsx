import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { z } from "zod";
import type { WeeklyOutput } from "@/agents/schemas";
import { AutoRefresh } from "@/components/auto-refresh";
import { OperatingNumbers } from "@/components/operating-numbers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import { companyReports, decisions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { OperatingMetrics } from "@/workflow/operating-metrics";
import { createWeeklyReport, weeklyDecisionAction } from "./actions";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "经营周报"), robots: { index: false, follow: false } };
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const { error, report } = await searchParams;
  const focused = z.uuid().safeParse(report).data;
  const db = getDb();
  const [reports, records] = await Promise.all([
    db.select().from(companyReports)
      .where(and(eq(companyReports.kind, "weekly"), focused ? eq(companyReports.id, focused) : undefined))
      .orderBy(desc(companyReports.createdAt)).limit(20),
    db.select().from(decisions).where(and(eq(decisions.gate, "weekly"), eq(decisions.actorRole, "founder"))),
  ]);
  const byReport = new Map(records.map((record) => [record.subjectId, record]));
  const working = reports.some(({ status }) => status === "queued" || status === "running");
  return (
    <main className="admin-section max-w-5xl">
      <header className="admin-section-heading">
        <div>
          <h1><T>经营周报</T></h1>
          <p><T>查看累计经营数据，并记录接下来怎么做。</T></p>
        </div>
        <form action={createWeeklyReport}><Button type="submit" disabled={working}><T>生成经营周报</T></Button></form>
      </header>
      {focused ? <Link href="/admin/reports" className="self-start text-sm underline underline-offset-4"><T>返回周报列表</T></Link> : null}
      {error ? <p className="text-destructive"><T>{String(error)}</T></p> : null}
      {working ? <><AutoRefresh /><p role="status"><T>秘书正在整理经营记录。</T></p></> : null}
      {!reports.length ? <p className="rounded-xl border bg-card px-4 py-5 text-sm text-muted-foreground"><T>还没有周报。</T></p> : null}
      {reports.map((report) => {
        const content = report.output as WeeklyOutput | null;
        const snapshot = report.input as OperatingMetrics | null;
        const decision = byReport.get(report.id);
        return (
          <Card key={report.id} id={report.id}>
            <CardHeader className="border-b pb-4">
              <CardTitle>{formatDateTime(report.createdAt)}<T> 经营周报</T></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {report.status === "failed" ? <p className="text-destructive"><T>生成失败。</T>{report.error}</p> : null}
              {content && snapshot ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-lg bg-secondary p-4">
                      <h2 className="mb-2 font-semibold"><T>经营摘要</T></h2>
                      <p className="leading-relaxed">{content.summary}</p>
                    </section>
                    <section className="rounded-lg bg-secondary p-4">
                      <h2 className="mb-2 font-semibold"><T>下一步建议</T></h2>
                      <ol className="list-decimal space-y-1 pl-5">{content.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ol>
                    </section>
                  </div>
                  {report.provider === "stub" ? <p className="text-muted-foreground"><T>文字由模拟模型生成。</T></p> : null}
                  {decision ? (
                    <p className="rounded-lg border p-3"><T>老板决定　</T>{decision.reason} · {formatDateTime(decision.createdAt)}</p>
                  ) : (
                    <form action={weeklyDecisionAction.bind(null, report.id)} className="grid gap-2 border-t pt-4">
                      <Label htmlFor={`choice-${report.id}`}><T>经营决定</T></Label>
                      <select id={`choice-${report.id}`} name="choice" className="w-fit rounded-md border border-input bg-background px-3 py-2">
                        <option value="continue"><T>继续</T></option><option value="pricing"><T>调价</T></option><option value="trim"><T>砍掉某项服务</T></option>
                      </select>
                      <Label htmlFor={`note-${report.id}`}><T>具体怎么执行</T></Label>
                      <Textarea id={`note-${report.id}`} name="note" required maxLength={1000} />
                      <Button type="submit" className="w-fit"><T>记录周报决定</T></Button>
                    </form>
                  )}
                  <section className="space-y-3 border-t pt-4">
                    <h2 className="font-semibold"><T>生成时的累计数据</T></h2>
                    <OperatingNumbers metrics={snapshot} />
                  </section>
                </>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
