import { T } from "@/components/ui-text";
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
      <summary className="cursor-pointer font-semibold"><T>编辑英文验证页 · 第 </T>{version}<T> 版</T></summary>
      <form action={action} className="mt-3 grid gap-3 text-sm">
        <input type="hidden" name="version" value={version} />
        <p><T>保存后生成新版本。数据和事实请作为声明单独登记并绑定证据，截图会随新版本一并审批。</T></p>
        <Label htmlFor="headline"><T>标题</T></Label>
        <Input id="headline" name="headline" required defaultValue={current.headline} maxLength={600} />
        <Label htmlFor="subheadline"><T>副标题</T></Label>
        <Textarea id="subheadline" name="subheadline" required defaultValue={current.subheadline} maxLength={600} />
        <Label htmlFor="value_props"><T>价值点 · 每行一项，最多四项</T></Label>
        <Textarea id="value_props" name="value_props" required defaultValue={current.value_props.join("\n")} maxLength={3000} />
        <Label htmlFor="scenarios"><T>使用场景 · 每行一项，最多三项</T></Label>
        <Textarea id="scenarios" name="scenarios" required defaultValue={current.scenarios.join("\n")} maxLength={3000} />
        <Label htmlFor="cta_label"><T>行动按钮文字</T></Label>
        <Input id="cta_label" name="cta_label" required defaultValue={current.cta_label} maxLength={600} />
        <Label htmlFor="form_prompt"><T>表单提示</T></Label>
        <Input id="form_prompt" name="form_prompt" required defaultValue={current.form_prompt} maxLength={600} />
        <Label htmlFor="landing-image"><T>随新版本发布的产品截图</T></Label>
        <select id="landing-image" name="image" defaultValue="keep" className="rounded-md border px-3 py-2">
          <option value="keep"><T>保留当前设置</T></option><option value="none"><T>本版本不展示截图</T></option>
          {view.images.filter((item) => item.kind === "product").map((item, index) => (
            <option value={item.id} key={item.id}>{item.note || <T>{`产品截图 ${index + 1}`}</T>}</option>
          ))}
        </select>
        {verified.length ? (
          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend><T>新增一条事实声明（选填）</T></legend>
            <Label htmlFor="new-claim"><T>声明原文</T></Label>
            <Textarea id="new-claim" name="claim" maxLength={600} />
            <Label htmlFor="claim-kind"><T>声明类型</T></Label>
            <select id="claim-kind" name="claim_kind" className="rounded-md border px-3 py-2">
              <option value="feature"><T>产品事实</T></option><option value="pain"><T>痛点</T></option>
              <option value="metric"><T>数字</T></option><option value="comparison"><T>比较</T></option>
            </select>
            <Label htmlFor="claim-evidence"><T>对应证据</T></Label>
            <select id="claim-evidence" name="evidence_id" className="min-w-0 w-full rounded-md border px-3 py-2">
              <option value=""><T>选择证据</T></option>
              {verified.map((item) => <option key={item.id} value={item.id}>{item.sourceName} · {item.excerpt.slice(0, 100)}</option>)}
            </select>
          </fieldset>
        ) : null}
        <Button type="submit" className="w-fit"><T>检查声明并保存新版本</T></Button>
      </form>
    </details>
  );
}
