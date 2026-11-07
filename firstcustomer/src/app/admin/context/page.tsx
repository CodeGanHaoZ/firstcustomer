import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import { LocalizedTag } from "@/components/localized-controls";
import { Download, Pencil } from "lucide-react";
import type { CSSProperties } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { companyDocuments, getCompanySettings } from "@/workflow/company-context";
import { saveCompanyContext } from "./actions";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "公司卷宗"), robots: { index: false, follow: false } };
}

export default async function ContextPage({ searchParams }: PageProps<"/admin/context">) {
  await requireAdmin();
  const { error } = await searchParams;
  const db = getDb();
  const [settings, docs] = await Promise.all([getCompanySettings(db), companyDocuments(db)]);
  return (
    <main className="admin-section">
      <header className="admin-section-heading">
        <div><h1><T>公司卷宗</T></h1><p><T>从当前数据库生成的 00–08 卷宗，导出时联系方式已脱敏。</T></p></div>
        <div className="flex flex-wrap gap-2">
          <a href="#company-settings-form" className={buttonVariants({ variant: "outline" })}><Pencil aria-hidden="true" /><T>编辑设置</T></a>
          <a href="/admin/context/export" className={buttonVariants()}><Download aria-hidden="true" /><T>导出 Markdown ZIP</T></a>
        </div>
      </header>
      {error ? <p role="alert" className="notice notice--fail"><T>{String(error)}</T></p> : null}
      <LocalizedTag as="section" aria-label="九份卷宗" className="grid items-start gap-3 md:grid-cols-2">
        {docs.map((doc, index) => (
          <details key={doc.name} className="fold rise" style={{ "--i": index } as CSSProperties}>
            <summary>
              <span className="flex items-center gap-3">
                <span className="font-serif text-lg text-[#456447]">{doc.name.match(/^\d+/)?.[0] ?? String(index).padStart(2, "0")}</span>
                <span className="fold__title">{doc.name.replace(/^\d+[\s._-]*/, "")}</span>
              </span>
            </summary>
            <pre className="fold__body m-0 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">{doc.body}</pre>
          </details>
        ))}
      </LocalizedTag>
      <details id="company-settings" className="fold scroll-mt-24">
        <summary>
          <span>
            <span className="fold__title block"><T>公司设置与宪章</T></span>
            <span className="fold__hint block"><span className={settings?.charterConfirmedAt ? "pill pill--ok" : "pill pill--wait"}><T>{settings?.charterConfirmedAt ? `闸门①已确认 · 第 ${settings.charterVersion} 版 · ${formatDateTime(settings.charterConfirmedAt)}` : "闸门①待老板确认"}</T></span></span>
          </span>
        </summary>
        <div className="fold__body">
          <form id="company-settings-form" action={saveCompanyContext} className="grid scroll-mt-24 gap-3 text-sm">
            <Label htmlFor="charter"><T>公司宪章 · 定位、对象、价值、红线</T></Label>
            <Textarea id="charter" name="charter" defaultValue={settings?.charter} maxLength={4000} rows={4} />
            <Label htmlFor="brand"><T>品牌语调</T></Label>
            <Textarea id="brand" name="brand" defaultValue={settings?.brand} maxLength={2000} />
            <Label htmlFor="forbiddenTerms"><T>禁用词 · 每行一个</T></Label>
            <Textarea id="forbiddenTerms" name="forbiddenTerms" defaultValue={settings?.forbiddenTerms.join("\n")} maxLength={1600} />
            <Label htmlFor="service"><T>出海机会分析和启动包服务定义</T></Label>
            <Textarea id="service" name="service" defaultValue={settings?.service} maxLength={3000} />
            <Label htmlFor="operations"><T>客服知识和标准流程</T></Label>
            <Textarea id="operations" name="operations" defaultValue={settings?.operations} maxLength={3000} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="intent" value="confirm"><T>保存并确认宪章</T></Button>
              <Button type="submit" name="intent" value="save" variant="outline"><T>保存设置</T></Button>
            </div>
          </form>
        </div>
      </details>
    </main>
  );
}
