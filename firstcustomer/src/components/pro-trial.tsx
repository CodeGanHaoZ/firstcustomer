import Link from "next/link";
import { getLocale } from "@/lib/locale-server";
import { PurchaseSubmit } from "./purchase-submit";

export async function ProTrial({ state, action, loginHref, guest = false, disabled = false }: {
  state: "offer" | "active"; action?: () => Promise<void>; loginHref: string; guest?: boolean; disabled?: boolean;
}) {
  const en = (await getLocale()) === "en";
  const active = state === "active";
  return <section id="pro-trial" className="paper paper--tan scroll-mt-24" aria-labelledby="pro-trial-title">
    <p className="eyebrow m-0">{en ? "New customer benefit" : "新用户专享"}</p>
    <h2 id="pro-trial-title" className="paper__title mt-1">{active ? en ? "Your free validation round is active" : "免费验证试用已开通" : en ? "Try one complete validation round free" : "免费体验 1 轮完整验证"}</h2>
    <p className="paper__lead">{en ? "Includes positioning, an English validation page, one channel action plan and a growth review. No payment is required; you confirm positioning and public launch." : "包含定位、英文验证页、单渠道方案和增长复盘，无需付款；定位与公开发布由你确认。"}</p>
    <p className="meta">{guest
      ? en ? "No sign-in required. One trial per browser, for one product and target market." : "无需登录，当前浏览器限领一次，适用于一个产品、一个目标市场。"
      : en ? "One trial per first-time Pro account, for one product and target market." : "首次使用 Pro 的账号限领一次，适用于一个产品、一个目标市场。"}
      {en ? " Revisions and system retries do not use another round. After the trial, ¥99 buys three additional rounds; there is no automatic charge." : "同轮修改和系统重试不扣次数。试用后 ¥99 可再购买 3 轮，不会自动扣费。"}</p>
    {active ? <><p role="status" className="notice notice--ok mb-0">{guest
      ? en ? "Your trial is bound to this project. Return from this browser's trial workspace, or save the private project link." : "免费试用已绑定此项目。可从本浏览器的试用工作台继续，也可保存项目专属链接。"
      : en ? "This trial is saved to your account. Review the results before deciding whether to buy Pro." : "本账号试用已绑定此项目，看完结果后再决定是否购买。"}</p>
      {guest ? <Link className="btn btn--ghost btn--sm mt-4" href={loginHref}>{en ? "Save to an account and continue on other devices" : "注册保存项目，跨设备继续"}</Link> : null}</>
      : <form action={action} className="pro-trial__action"><PurchaseSubmit disabled={disabled} label="领取 1 轮免费试用并开始" pendingLabel="正在开通免费试用…" /></form>}
  </section>;
}
