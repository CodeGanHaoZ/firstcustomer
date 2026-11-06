import Image from "next/image";
import type { ProposalOutput } from "@/agents/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatYuan } from "@/lib/format";

export function ProposalDetails({ proposal, version, quoteFen }: {
  proposal: ProposalOutput;
  version: number;
  quoteFen: number | null;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-semibold">首客启动包 · 第 {version} 版{quoteFen === null ? "" : ` · ${formatYuan(quoteFen)}`}</p>
      <p>{proposal.scope}</p>
      <div>
        <p className="font-medium">交付清单</p>
        <ul className="list-disc pl-5">{proposal.deliverables.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </div>
      <p><strong className="font-medium">预计周期</strong>　{proposal.timing}</p>
      <p><strong className="font-medium">服务条款</strong>　{proposal.terms}</p>
    </div>
  );
}

export function ReceiptUpload({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="receipt">付款截图（最大 5 MB）</Label>
        <Input id="receipt" name="receipt" type="file" accept="image/png,image/jpeg,image/webp" required />
      </div>
      <Button type="submit" variant="outline">上传付款截图</Button>
    </form>
  );
}

export function PaymentCodeImage({ token }: { token: string }) {
  return (
    <Image unoptimized src={`/p/${token}/payment-code`} width={200} height={200}
      alt="首客收款码" className="h-auto max-w-full rounded-md border object-contain" />
  );
}
