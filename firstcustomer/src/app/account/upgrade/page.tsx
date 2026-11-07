import Link from "next/link";
import { PageHead, SceneFooter, SiteHeader } from "@/components/site-chrome";
import { getLocale } from "@/lib/locale-server";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { customerMembership } from "@/workflow/membership";

export const metadata = { title: "Free 与 Pro · 首客 HiFirst", robots: { index: false, follow: false } };

export default async function UpgradePage() {
  const session = await getCustomerSession();
  if (session && (await customerMembership(getDb(), session.user.id)).plan === "pro") redirect("/account/pro");
  const en = (await getLocale()) === "en";
  return <div className="site-shell"><SiteHeader current="account" /><main className="site-main">
    <PageHead title={en ? "Turn opportunities into a validation plan" : "把机会变成验证方案"} lead={en ? "Keep using Free, or explore the Pro modules." : "继续使用 Free，或了解 Pro 提供的高级工作模块。"} />
    <div className="card-grid"><section className="paper"><h2 className="paper__title">Free</h2><p>{en ? "Market opportunity report, candidate audiences, evidence and questions to validate." : "出海机会报告、候选人群、支持与反面证据、待验证问题。"}</p><Link href="/account" className="btn btn--ghost">{en ? "Continue with Free" : "继续使用 Free"}</Link></section>
      <section className="paper paper--tan"><h2 className="paper__title">Pro</h2><p>{en ? "Positioning, an English validation page, channel planning and growth review, accessible from your Pro account." : "定位方案、英文验证页、渠道行动与增长复盘，已开通的 Pro 账号可直接进入对应模块。"}</p>
        <p className="notice">{en ? "Pricing has not been published yet. Online purchase is not available, and this page does not charge or activate Pro." : "价格尚未公布，暂未开放在线购买。此页面不会扣费或自动开通 Pro。"}</p>
        {session ? <Link href="/account" className="btn btn--primary">{en ? "Back to your Free workspace" : "返回 Free 工作台"}</Link> : <Link href="/login?next=%2Faccount%2Fpro" className="btn btn--primary">{en ? "Already have Pro? Log in" : "已有 Pro？登录进入"}</Link>}
      </section></div>
  </main><SceneFooter /></div>;
}
