"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { T } from "./ui-text";

function QuoteFields({ quoteFen }: { quoteFen: number | null }) {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} className="owner-quote-fields">
    <div className="grid gap-2">
      <Label htmlFor="owner-quote-yuan"><T>批准价格（人民币元）</T></Label>
      <Input id="owner-quote-yuan" name="yuan" type="number" inputMode="decimal" min="0.01" max="21474836.47" step="0.01"
        defaultValue={quoteFen === null ? "" : (quoteFen / 100).toFixed(2)} required aria-describedby="owner-quote-help" />
      <p id="owner-quote-help" className="meta"><T>确认后发送给客户接受，到账仍需单独核对。</T></p>
    </div>
    <div className="flex flex-wrap items-start gap-3">
      <Button type="submit" name="verdict" value="approve"><T>{pending ? "正在保存…" : "确认价格与条款"}</T></Button>
      <details className="owner-reject">
        <summary><T>退回修改</T></summary>
        <div className="grid gap-3 pt-3">
          <Label htmlFor="owner-quote-reason"><T>退回原因</T></Label>
          <Textarea id="owner-quote-reason" name="reason" maxLength={500} rows={3} />
          <Button type="submit" name="verdict" value="reject" variant="outline" formNoValidate><T>提交退回</T></Button>
        </div>
      </details>
    </div>
    <span role="status" className="sr-only"><T>{pending ? "正在保存报价决定，请稍候" : ""}</T></span>
  </fieldset>;
}

export function OwnerQuoteForm({ action, version, quoteFen }: {
  action: (formData: FormData) => Promise<void>; version: number; quoteFen: number | null;
}) {
  return <form action={action}>
    <input type="hidden" name="version" value={version} />
    <input type="hidden" name="returnTo" value="/admin/owner" />
    <QuoteFields quoteFen={quoteFen} />
  </form>;
}
