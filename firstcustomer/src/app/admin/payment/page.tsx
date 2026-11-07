import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import { ImageUploadInput } from "@/components/image-upload-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { hostedUploadLimit } from "@/lib/uploads";
import { hasPaymentCode } from "@/workflow/commerce";
import { uploadPaymentCodeAction } from "../actions";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "首客收款设置"), robots: { index: false, follow: false } };
}

export default async function PaymentSettingsPage({ searchParams }: PageProps<"/admin/payment">) {
  await requireAdmin();
  const [{ error, saved }, codeReady] = await Promise.all([searchParams, hasPaymentCode(getDb())]);
  return (
    <main className="admin-section max-w-3xl">
      <header className="admin-section-heading">
        <div>
          <h1><T>首客收款设置</T></h1>
          <p><T>由首客团队配置服务费收款码。客户接受报价后，可在自己的项目页查看付款说明。</T></p>
        </div>
      </header>
      <Card>
        <CardHeader><CardTitle><T>服务费收款码</T></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p><T>{codeReady ? "已配置收款码。" : "尚未配置收款码。"}</T></p>
          {error ? <p role="alert" className="text-destructive"><T>{String(error)}</T></p> : null}
          {saved === "1" && codeReady ? <p role="status"><T>已保存新的收款码。</T></p> : null}
          <form action={uploadPaymentCodeAction} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="payment-code-file"><T>收款码图片（最大 </T>{hostedUploadLimit ? 4 : 5} MB）</Label>
              <ImageUploadInput id="payment-code-file" name="paymentCode" required maxTotalBytes={hostedUploadLimit} />
            </div>
            <Button type="submit"><T>{codeReady ? "更换收款码" : "上传收款码"}</T></Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
