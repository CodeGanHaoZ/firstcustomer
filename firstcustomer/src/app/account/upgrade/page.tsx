import Link from "next/link";
import { PageHead, SceneFooter, SiteHeader } from "@/components/site-chrome";
import { getLocale } from "@/lib/locale-server";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { customerProTrial, guestProTrial } from "@/workflow/purchases";
import { currentProTrialVisitor } from "@/lib/pro-trial-visitor";
import { customerMembership } from "@/workflow/membership";
import { desc, eq } from "drizzle-orm";
import { projects } from "@/db/schema";
import { accountProjectToken } from "@/lib/customer-project";

export const metadata = { title: "Free 与 Pro · 首客 HiFirst", robots: { index: false, follow: false } };

export default async function UpgradePage() {
  const session = await getCustomerSession();
  if (session && (await customerMembership(getDb(), session.user.id)).plan === "pro") redirect("/account/pro");
  const en = (await getLocale()) === "en";
  const proTrial = await customerProTrial(getDb(), session?.user.id);
  const browserTrial = await guestProTrial(getDb(), await currentProTrialVisitor());
  const owned = session ? await getDb().select({ id: projects.id, productName: projects.productName, status: projects.status })
    .from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt)) : [];
  return <div className="site-shell"><SiteHeader current="account" /><main className="site-main">
    <PageHead title={en ? "Turn opportunities into a validation plan" : "把机会变成验证方案"} lead={en ? "Keep using Free, or explore the Pro modules." : "继续使用 Free，或了解 Pro 提供的高级工作模块。"} />
    <div className="card-grid"><section className="paper"><h2 className="paper__title">Free</h2><p>{en ? "Market opportunity report, candidate audiences, evidence and questions to validate." : "出海机会报告、候选人群、支持与反面证据、待验证问题。"}</p><Link href="/account" className="btn btn--ghost">{en ? "Continue with Free" : "继续使用 Free"}</Link></section>
      {(!session || proTrial.eligible) && !browserTrial ? <section className="paper paper--apricot"><h2 className="paper__title">{en ? "One complete round free for new customers" : "新用户免费体验 1 轮完整验证"}</h2><p>{en ? "Create a project without signing in. After its free opportunity report, claim one complete Pro trial. One per browser; no payment or automatic renewal. Sign up later to save your results. Afterwards, ¥99 buys three additional rounds." : "无需登录即可创建项目，免费报告完成后领取一轮完整 Pro 试用。当前浏览器限领一次，无需付款或自动续费；注册可保存成果、跨设备继续。试用后 ¥99 可再购买 3 轮。"}</p><Link href="/projects/new" className="btn btn--primary">{en ? "Start your free trial" : "开始免费试用"}</Link></section> : null}
      <section className="paper paper--tan"><h2 className="paper__title">Pro</h2><p>{en ? "Three complete validation rounds for one product and target market. Each includes positioning, an English page, a channel plan and a review. Revisions and retries within a round do not use another round." : "一个产品、一个目标市场，包含三轮完整验证；每轮都有定位、英文页、渠道方案和复盘，同轮修改与失败重试不扣轮数。"}</p>
        <p className="notice">{en ? "Your project page shows the quote after Free analysis. Confirm the scope and amount, then pay. Your team starts automatically after payment verification." : "免费分析完成后，项目页会显示报价。确认服务范围与金额并完成付款后，团队自动开始执行，无需申请审批。"}</p>
        <div className="flex flex-wrap gap-2">{owned.map((project) => <Link key={project.id} href={`/p/${accountProjectToken(project.id)}#pro`} className="btn btn--ghost btn--sm">{project.productName}</Link>)}</div>
        <Link href={session ? "/account" : "/projects/new"} className="btn btn--primary mt-5">{en ? "Choose a project" : "选择出海项目"}</Link>
      </section></div>
  </main><SceneFooter /></div>;
}
