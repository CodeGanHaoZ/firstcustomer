import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { hasPaymentCode } from "@/workflow/commerce";
import { uploadPaymentCodeAction } from "../actions";

export const metadata: Metadata = { title: "首客收款设置", robots: { index: false, follow: false } };

export default async function PaymentSettingsPage({ searchParams }: PageProps<"/admin/payment">) {
  await requireAdmin();
  const [{ error, saved }, codeReady] = await Promise.all([searchParams, hasPaymentCode(getDb())]);
  return (
    <main className="admin-section max-w-3xl">
      <header className="admin-section-heading">
        <div>
          <h1>首客收款设置</h1>
          <p>由首客团队配置服务费收款码。客户接受报价后，可在自己的项目页查看付款说明。</p>
        </div>
      </header>
      <Card>
        <CardHeader><CardTitle>服务费收款码</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>{codeReady ? "已配置收款码。" : "尚未配置收款码。"}</p>
          {error ? <p role="alert" className="text-destructive">{String(error)}</p> : null}
          {saved === "1" && codeReady ? <p role="status">已保存新的收款码。</p> : null}
          <form action={uploadPaymentCodeAction} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="payment-code-file">收款码图片（最大 5 MB）</Label>
              <Input id="payment-code-file" name="paymentCode" type="file" accept="image/png,image/jpeg,image/webp" required />
            </div>
            <Button type="submit">{codeReady ? "更换收款码" : "上传收款码"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
