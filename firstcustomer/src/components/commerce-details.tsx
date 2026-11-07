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
    <div className="grid gap-5 text-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-[#faebd4] p-5">
        <div>
          <p className="eyebrow m-0"><T>首客启动包 · 第 </T>{version}<T> 版</T></p>
          <p className="m-0 max-w-[36em] leading-relaxed">{proposal.scope}</p>
        </div>
        {quoteFen === null ? null : <p className="m-0 font-serif text-[2.4rem] leading-none text-[#101210]">{formatYuan(quoteFen)}</p>}
      </div>
      <div>
        <p className="eyebrow"><T>交付清单</T></p>
        <ul className="m-0 grid gap-2 ps-0 list-none sm:grid-cols-2">{proposal.deliverables.map((item, i) => <li key={i} className="flex gap-3 rounded-xl border bg-background px-4 py-3"><span className="font-serif text-[#456447]">{String(i + 1).padStart(2, "0")}</span><span>{item}</span></li>)}</ul>
      </div>
      <dl className="kv m-0">
        <div><dt><T>预计周期</T></dt><dd>{proposal.timing}</dd></div>
        <div><dt><T>服务条款</T></dt><dd>{proposal.terms}</dd></div>
      </dl>
    </div>
  );
}

export function ReceiptUpload({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-input p-4">
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
      alt="首客收款码" className="h-auto max-w-full rounded-2xl border bg-white p-2 object-contain" />
  );
}
