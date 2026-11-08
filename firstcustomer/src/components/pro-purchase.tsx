import { getLocale } from "@/lib/locale-server";
import { formatDateTime, formatYuan } from "@/lib/format";
import { PurchaseSubmit } from "./purchase-submit";

type Props = {
  state: "offer" | "checkout" | "active";
  productName: string; targetMarket: string | null; round: number; amountFen: number;
  includedRounds: number; startedRounds?: number; remainingRounds?: number;
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
    <p className="paper__lead">{en ? `One product, one target market and ${props.includedRounds} complete validation round(s). Each round includes positioning, an English validation page, one channel action plan and a growth review.` : `一个产品、一个目标市场，包含 ${props.includedRounds} 轮完整验证。每轮都有定位方案、英文验证页、单渠道行动方案和增长复盘。`}</p>
    {active ? <p className="font-medium" aria-label={en ? "Package rounds" : "套餐轮次"}>{en ? `Started ${props.startedRounds ?? 1} of ${props.includedRounds} rounds · ${props.remainingRounds ?? 0} remaining` : `已启动 ${props.startedRounds ?? 1} / ${props.includedRounds} 轮 · 剩余 ${props.remainingRounds ?? 0} 轮`}</p> : null}
    {active ? <p className="notice notice--ok mb-0" role="status">{en ? "Payment verified. Your included rounds are active; you confirm positioning, publishing and each new round." : "付款校验已完成，套餐内轮次已开通；定位、公开发布和开启下一轮由你确认。"}{props.paidAt ? ` · ${formatDateTime(props.paidAt)}` : ""}</p> : <>
      <p className="meta">{en ? "One-time payment, no recurring subscription. Existing research is reused. Revisions and system retries within a round do not use another round. Extra markets, advertising and human services are excluded." : "一次付费，无自动续费；复用已有研究。同轮改稿、系统失败重试不扣轮数。新增市场、广告费和人工服务不包含在本次购买中。"}</p>
      <form action={props.action} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="quoteFingerprint" value={props.fingerprint} />
        {checkout && props.paymentId ? <input type="hidden" name="paymentId" value={props.paymentId} /> : null}
        <PurchaseSubmit disabled={props.disabled} label={checkout ? "付款并开通 Pro" : "确认服务，前往支付"} pendingLabel={checkout ? "正在校验付款…" : "正在创建订单…"} />
        <span className="text-sm text-muted-foreground">{en ? "Pro starts automatically after payment verification." : "付款校验通过后自动开通并开始执行。"}</span>
      </form>
    </>}
  </section>;
}
