import { getLocale } from "@/lib/locale-server";
import { formatDateTime, formatYuan } from "@/lib/format";
import { PurchaseSubmit } from "./purchase-submit";

type Props = {
  state: "offer" | "checkout" | "active";
  productName: string; targetMarket: string | null; round: number; amountFen: number;
  fingerprint: string; paymentId?: string; paidAt?: Date | null; disabled?: boolean;
  action: (formData: FormData) => Promise<void>;
};

// Public checkout receives only customer-facing data, never provider mode,
// simulated references, estimated internal costs, or accounting statuses.
export async function ProPurchase(props: Props) {
  const en = (await getLocale()) === "en";
  const active = props.state === "active";
  const checkout = props.state === "checkout";
  const title = active ? en ? "Pro is active for this project" : "本项目 Pro 已开通"
    : checkout ? en ? "Confirm your payment" : "确认付款" : en ? "Continue with Pro" : "购买 Pro，继续验证";
  return <section id={checkout ? "payment" : "pro"} className={`paper ${active ? "paper--tan" : "paper--apricot"} rise scroll-mt-24`} aria-labelledby="pro-purchase-title">
    <div className="paper__head">
      <div><p className="eyebrow m-0">Pro · {en ? "Project service" : "项目服务"}</p>
        <h2 id="pro-purchase-title" className="paper__title mt-1">{title}</h2>
        <p className="paper__lead">{props.productName}{props.targetMarket ? ` · ${props.targetMarket}` : ""} · {en ? `Round ${props.round}` : `第 ${props.round} 轮`}</p>
      </div>
      <p className="m-0 text-3xl font-semibold tabular-nums">{formatYuan(props.amountFen)}<span className="ml-2 text-sm font-normal text-muted-foreground">/ {en ? "project" : "项目"}</span></p>
    </div>
    <p className="paper__lead">{en ? "Includes positioning, an English validation page, a channel action plan and a growth review for this project's current scope." : "包含本项目当前范围的定位方案、英文验证页、渠道行动方案和一轮增长复盘。"}</p>
    {active ? <p className="notice notice--ok mb-0" role="status">{en ? "Payment verified. Your team continues automatically; you confirm the positioning and public launch." : "付款校验已完成，团队将自动继续执行；定位方案和公开发布由你确认。"}{props.paidAt ? ` · ${formatDateTime(props.paidAt)}` : ""}</p> : <>
      <p className="meta">{en ? "One purchase applies to this project. Paid promotion and additional human services require a separate quote." : "一次购买仅开通当前项目。付费推广和额外人工服务需另行确认报价。"}</p>
      <form action={props.action} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="quoteFingerprint" value={props.fingerprint} />
        {checkout && props.paymentId ? <input type="hidden" name="paymentId" value={props.paymentId} /> : null}
        <PurchaseSubmit disabled={props.disabled} label={checkout ? "付款并开通 Pro" : "确认报价，前往支付"} pendingLabel={checkout ? "正在校验付款…" : "正在创建订单…"} />
        <span className="text-sm text-muted-foreground">{en ? "Pro starts automatically after payment verification." : "付款校验通过后自动开通并开始执行。"}</span>
      </form>
    </>}
  </section>;
}
