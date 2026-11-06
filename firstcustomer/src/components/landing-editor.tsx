import type { PageContent } from "@/agents/schemas";
import type { ProjectView } from "@/workflow/queries";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export function LandingEditor({ view, action }: { view: ProjectView; action: (formData: FormData) => Promise<void> }) {
  if (!view.page) return null;
  const { version, content } = view.page;
  const current = content as PageContent;
  const verified = view.evidence.filter((item) => item.status === "verified");
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-semibold">编辑英文验证页 · 第 {version} 版</summary>
      <form action={action} className="mt-3 grid gap-3 text-sm">
        <input type="hidden" name="version" value={version} />
        <p>保存后生成新版本。数据和事实请作为声明单独登记并绑定证据，截图会随新版本一并审批。</p>
        <Label htmlFor="headline">标题</Label>
        <Input id="headline" name="headline" required defaultValue={current.headline} maxLength={600} />
        <Label htmlFor="subheadline">副标题</Label>
        <Textarea id="subheadline" name="subheadline" required defaultValue={current.subheadline} maxLength={600} />
        <Label htmlFor="value_props">价值点 · 每行一项，最多四项</Label>
        <Textarea id="value_props" name="value_props" required defaultValue={current.value_props.join("\n")} maxLength={3000} />
        <Label htmlFor="scenarios">使用场景 · 每行一项，最多三项</Label>
        <Textarea id="scenarios" name="scenarios" required defaultValue={current.scenarios.join("\n")} maxLength={3000} />
        <Label htmlFor="cta_label">行动按钮文字</Label>
        <Input id="cta_label" name="cta_label" required defaultValue={current.cta_label} maxLength={600} />
        <Label htmlFor="form_prompt">表单提示</Label>
        <Input id="form_prompt" name="form_prompt" required defaultValue={current.form_prompt} maxLength={600} />
        <Label htmlFor="landing-image">随新版本发布的产品截图</Label>
        <select id="landing-image" name="image" defaultValue="keep" className="rounded-md border px-3 py-2">
          <option value="keep">保留当前设置</option><option value="none">本版本不展示截图</option>
          {view.images.filter((item) => item.kind === "product").map((item, index) => (
            <option value={item.id} key={item.id}>{item.note || `产品截图 ${index + 1}`}</option>
          ))}
        </select>
        {verified.length ? (
          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend>新增一条事实声明（选填）</legend>
            <Label htmlFor="new-claim">声明原文</Label>
            <Textarea id="new-claim" name="claim" maxLength={600} />
            <Label htmlFor="claim-kind">声明类型</Label>
            <select id="claim-kind" name="claim_kind" className="rounded-md border px-3 py-2">
              <option value="feature">产品事实</option><option value="pain">痛点</option>
              <option value="metric">数字</option><option value="comparison">比较</option>
            </select>
            <Label htmlFor="claim-evidence">对应证据</Label>
            <select id="claim-evidence" name="evidence_id" className="min-w-0 w-full rounded-md border px-3 py-2">
              <option value="">选择证据</option>
              {verified.map((item) => <option key={item.id} value={item.id}>{item.sourceName} · {item.excerpt.slice(0, 100)}</option>)}
            </select>
          </fieldset>
        ) : null}
        <Button type="submit" className="w-fit">检查声明并保存新版本</Button>
      </form>
    </details>
  );
}
