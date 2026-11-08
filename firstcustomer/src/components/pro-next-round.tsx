import { getLocale } from "@/lib/locale-server";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PurchaseSubmit } from "./purchase-submit";

export async function ProNextRound({ round, remaining, disabled, action }: {
  round: number; remaining: number; disabled: boolean; action: (data: FormData) => Promise<void>;
}) {
  const en = (await getLocale()) === "en";
  return <section id="next-round" className="paper scroll-mt-24" aria-labelledby="next-round-title">
    <h2 id="next-round-title" className="paper__title">{en ? "Your next validation round" : "继续下一轮验证"}</h2>
    {remaining > 0 ? <>
      <p className="paper__lead">{en ? `${remaining} round(s) remain in this purchase. After reviewing this round, you can refine positioning, the page or channel for the same product and market.` : `本次购买还剩 ${remaining} 轮。看完本轮复盘后，可在同一产品和目标市场内调整定位、页面或渠道，继续验证。`}</p>
      <p className="meta">{en ? "Starting uses one included round. Existing published pages stay live until you approve a new version. You can also finish now and keep your unused rounds." : "确认开启后使用 1 轮。已有公开页面会保留，直到你确认发布新版本；也可以先完成本轮交付，保留剩余轮数。"}</p>
      <form action={action} className="mt-5 grid gap-3">
        <input type="hidden" name="round" value={round} />
        <Label htmlFor="next-round-focus">{en ? "What would you like to adjust? (optional)" : "下一轮想调整什么（选填）"}</Label>
        <Textarea id="next-round-focus" name="focus" maxLength={500} rows={3} />
        <div><PurchaseSubmit disabled={disabled} label="确认使用 1 轮，继续验证" pendingLabel="正在开启下一轮…" /></div>
      </form>
    </> : <p className="paper__lead">{en ? "All included rounds have been started. Your reports and deliverables remain available. Revisions and failed-task retries within the current round do not require another purchase." : "套餐内轮数已全部启动，历史报告与成果仍可查看。当前轮范围内的修改和失败重试无需重新购买。"}</p>}
  </section>;
}
