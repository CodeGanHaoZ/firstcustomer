import { LocalizedImage } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import type { ProposalOutput } from "@/agents/schemas";
import { ImageUploadInput } from "@/components/image-upload-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatYuan } from "@/lib/format";
import { hostedUploadLimit } from "@/lib/uploads";

export function ProposalDetails({ proposal, version, quoteFen }: {
  proposal: ProposalOutput;
  version: number;
  quoteFen: number | null;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-semibold"><T>首客启动包 · 第 </T>{version}<T> 版</T>{quoteFen === null ? "" : ` · ${formatYuan(quoteFen)}`}</p>
      <p>{proposal.scope}</p>
      <div>
        <p className="font-medium"><T>交付清单</T></p>
        <ul className="list-disc pl-5">{proposal.deliverables.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </div>
      <p><strong className="font-medium"><T>预计周期</T></strong>　{proposal.timing}</p>
      <p><strong className="font-medium"><T>服务条款</T></strong>　{proposal.terms}</p>
    </div>
  );
}

export function ReceiptUpload({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="receipt"><T>付款截图（最大 </T>{hostedUploadLimit ? 4 : 5} MB）</Label>
        <ImageUploadInput id="receipt" name="receipt" required maxTotalBytes={hostedUploadLimit} />
      </div>
      <Button type="submit" variant="outline"><T>上传付款截图</T></Button>
    </form>
  );
}

export function PaymentCodeImage({ token }: { token: string }) {
  return (
    <LocalizedImage unoptimized src={`/p/${token}/payment-code`} width={200} height={200}
      alt="首客收款码" className="h-auto max-w-full rounded-md border object-contain" />
  );
}
