import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { companyDocuments, getCompanySettings } from "@/workflow/company-context";
import { saveCompanyContext } from "./actions";

export const metadata = { title: "公司卷宗", robots: { index: false, follow: false } };

export default async function ContextPage({ searchParams }: PageProps<"/admin/context">) {
  await requireAdmin();
  const { error } = await searchParams;
  const db = getDb();
  const [settings, docs] = await Promise.all([getCompanySettings(db), companyDocuments(db)]);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
      <Link href="/admin" className="self-start text-sm underline">返回办公室</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">公司卷宗</h1><p className="mt-1 text-sm text-muted-foreground">从当前数据库生成的 00–08 卷宗，导出时联系方式已脱敏。</p></div>
        <a href="/admin/context/export" className="rounded-md border px-3 py-2 text-sm font-medium">导出 Markdown ZIP</a>
      </header>
      {error ? <p className="text-destructive">{String(error)}</p> : null}
      <Card>
        <CardHeader><CardTitle>公司设置与宪章</CardTitle></CardHeader>
        <CardContent>
          <form action={saveCompanyContext} className="grid gap-3 text-sm">
            <p>{settings?.charterConfirmedAt ? `闸门①已确认 · 第 ${settings.charterVersion} 版 · ${formatDateTime(settings.charterConfirmedAt)}` : "闸门①待老板确认"}</p>
            <Label htmlFor="charter">公司宪章 · 定位、对象、价值、红线</Label>
            <Textarea id="charter" name="charter" defaultValue={settings?.charter} maxLength={4000} rows={4} />
            <Label htmlFor="brand">品牌语调</Label>
            <Textarea id="brand" name="brand" defaultValue={settings?.brand} maxLength={2000} />
            <Label htmlFor="forbiddenTerms">禁用词 · 每行一个</Label>
            <Textarea id="forbiddenTerms" name="forbiddenTerms" defaultValue={settings?.forbiddenTerms.join("\n")} maxLength={1600} />
            <Label htmlFor="service">初诊和启动包服务定义</Label>
            <Textarea id="service" name="service" defaultValue={settings?.service} maxLength={3000} />
            <Label htmlFor="operations">客服知识和标准流程</Label>
            <Textarea id="operations" name="operations" defaultValue={settings?.operations} maxLength={3000} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="intent" value="save" variant="outline">保存设置</Button>
              <Button type="submit" name="intent" value="confirm">保存并确认宪章</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <section aria-label="九份卷宗" className="grid gap-2">
        {docs.map((doc) => (
          <details key={doc.name} className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">{doc.name}</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{doc.body}</pre>
          </details>
        ))}
      </section>
    </main>
  );
}
