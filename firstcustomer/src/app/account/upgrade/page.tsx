import Link from "next/link";
import { PageHead, SceneFooter, SiteHeader } from "@/components/site-chrome";
import { getLocale } from "@/lib/locale-server";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCustomerSession } from "@/lib/customer-auth";
import { customerMembership } from "@/workflow/membership";
import { desc, eq } from "drizzle-orm";
import { projects } from "@/db/schema";
import { accountProjectToken } from "@/lib/customer-project";

export const metadata = { title: "Free 与 Pro · 首客 HiFirst", robots: { index: false, follow: false } };

export default async function UpgradePage() {
  const session = await getCustomerSession();
  if (session && (await customerMembership(getDb(), session.user.id)).plan === "pro") redirect("/account/pro");
  const en = (await getLocale()) === "en";
  const owned = session ? await getDb().select({ id: projects.id, productName: projects.productName, status: projects.status })
    .from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt)) : [];
  return <div className="site-shell"><SiteHeader current="account" /><main className="site-main">
    <PageHead title={en ? "Turn opportunities into a validation plan" : "把机会变成验证方案"} lead={en ? "Keep using Free, or explore the Pro modules." : "继续使用 Free，或了解 Pro 提供的高级工作模块。"} />
    <div className="card-grid"><section className="paper"><h2 className="paper__title">Free</h2><p>{en ? "Market opportunity report, candidate audiences, evidence and questions to validate." : "出海机会报告、候选人群、支持与反面证据、待验证问题。"}</p><Link href="/account" className="btn btn--ghost">{en ? "Continue with Free" : "继续使用 Free"}</Link></section>
      <section className="paper paper--tan"><h2 className="paper__title">Pro</h2><p>{en ? "Positioning, an English validation page, a channel action plan and one growth review. Purchase applies to the current project." : "定位方案、英文验证页、渠道行动方案与一轮增长复盘，按项目购买并开通对应模块。"}</p>
        <p className="notice">{en ? "Your project page shows the quote after Free analysis. Confirm the scope and amount, then pay. Your team starts automatically after payment verification." : "免费分析完成后，项目页会显示报价。确认服务范围与金额并完成付款后，团队自动开始执行，无需申请审批。"}</p>
        <div className="flex flex-wrap gap-2">{owned.map((project) => <Link key={project.id} href={`/p/${accountProjectToken(project.id)}#pro`} className="btn btn--ghost btn--sm">{project.productName}</Link>)}</div>
        <Link href={session ? "/account" : "/projects/new"} className="btn btn--primary mt-5">{en ? "Choose a project" : "选择出海项目"}</Link>
      </section></div>
  </main><SceneFooter /></div>;
}
