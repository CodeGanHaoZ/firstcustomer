"use client";

import { useFormStatus } from "react-dom";
import { KeyRound } from "lucide-react";
import { LocalizedInput } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function KeyFields() {
  const { pending } = useFormStatus();
  return <>
    <div className="grid min-w-0 flex-1 gap-2">
      <Label htmlFor="pro-key"><T>Pro 开通密钥</T></Label>
      <LocalizedInput id="pro-key" name="proKey" type="password" required minLength={32} maxLength={256}
        autoComplete="off" autoCapitalize="none" spellCheck={false} readOnly={pending}
        aria-describedby="pro-key-help" placeholder="输入首客提供的 Pro 密钥" className="min-h-11" />
    </div>
    <Button type="submit" size="lg" disabled={pending}>
      <KeyRound size={16} aria-hidden="true" /><T>{pending ? "正在验证密钥…" : "验证密钥并开通 Pro"}</T>
    </Button>
  </>;
}

export function ProKeyForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return <div className="mt-5 border-t pt-5">
    <p id="pro-key-help" className="m-0 text-sm leading-relaxed text-muted-foreground"><T>已有密钥？验证后即可开通当前项目的 Pro，开始制定策略，无需上传付款截图。</T></p>
    <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <KeyFields />
    </form>
  </div>;
}
