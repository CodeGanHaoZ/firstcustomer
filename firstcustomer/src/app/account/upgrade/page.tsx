import { ArrowRight, Check, Clock3, Layers3, Search, Sparkles } from "lucide-react";
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

type ComparisonRow = { label: string; free: string; pro: string };

export default async function UpgradePage() {
  const session = await getCustomerSession();
  if (session && (await customerMembership(getDb(), session.user.id)).plan === "pro") redirect("/account/pro");
  const en = (await getLocale()) === "en";
  const proTrial = await customerProTrial(getDb(), session?.user.id);
  const browserTrial = await guestProTrial(getDb(), await currentProTrialVisitor());
  const owned = session ? await getDb().select({ id: projects.id, productName: projects.productName, status: projects.status })
    .from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt)) : [];
  const comparison: ComparisonRow[] = en ? [
    { label: "Research depth", free: "Opportunity scan", pro: "Opportunity scan + strategic synthesis" },
    { label: "AI workflow", free: "Standard analysis queue", pro: "Evidence-backed positioning and a complete validation workflow" },
    { label: "Evidence and search", free: "Candidate audiences, evidence and open questions", pro: "Expanded market evidence and overseas search for the active project" },
    { label: "Deliverables", free: "Opportunity report", pro: "Three rounds of positioning, English pages, channel plans and growth reviews" },
    { label: "Execution", free: "Decide what to validate next", pro: "One free trial round; three additional rounds after payment verification" },
  ] : [
    { label: "研究深度", free: "出海机会扫描", pro: "机会扫描 + 定位与战略综合判断" },
    { label: "AI 工作链路", free: "标准分析队列", pro: "基于证据的定位判断和完整验证链路" },
    { label: "证据与搜索", free: "候选人群、支持/反面证据、待验证问题", pro: "当前项目的扩展市场证据与海外搜索" },
    { label: "交付内容", free: "出海机会报告", pro: "三轮定位方案、英文验证页、渠道行动方案与增长复盘" },
    { label: "执行方式", free: "帮助你决定下一步验证什么", pro: "免费试用一轮；付款后再开通三轮完整验证" },
  ];

  const freeFeatures = en
    ? ["Opportunity report and candidate audiences", "Support and counter evidence with open questions", "No payment required to start the first analysis"]
    : ["出海机会报告与候选人群", "支持与反面证据，以及待验证问题", "无需付款即可开始第一轮分析"];
  const proFeatures = en
    ? ["A positioning and validation strategy", "An English validation page and channel action plan", "Three complete validation rounds; revisions and retries do not use another round"]
    : ["定位与验证策略方案", "英文验证页与渠道行动方案", "包含三轮完整验证，同轮修改与重试不扣次数"];

  return <div className="site-shell"><SiteHeader current="account" /><main className="site-main site-main--upgrade">
    <PageHead
      eyebrow={<span className="upgrade-eyebrow"><Sparkles size={15} aria-hidden="true" /> Free / Pro 工作台选择</span>}
      title={en ? "Choose the depth of your validation" : "选择适合你的验证深度"}
      lead={en ? "Start with a free opportunity scan and try one full Pro round without signing in. Afterwards, buy three additional rounds for ¥99." : "先用 Free 找到机会，无需登录即可体验一轮完整 Pro 验证。试用后可自愿购买 ¥99 三轮套餐，不会自动收费。"}
    />

    {(!session || proTrial.eligible) && !browserTrial ? <section className="paper paper--apricot upgrade-trial mb-6">
      <h2 className="paper__title">{en ? "Try one complete round free, without signing in" : "无需登录，免费体验 1 轮完整验证"}</h2>
      <p>{en ? "Create your project and read the free opportunity report, then claim a full Pro trial. One per browser, no payment required. Sign up later to save your results and continue on other devices." : "直接创建项目，免费报告完成后即可领取完整 Pro 试用，当前浏览器限领一次，无需付款。注册仅用于保存成果、跨设备继续，不会再额外赠送一轮。"}</p>
      <Link href="/projects/new" className="btn btn--primary">{en ? "Start your free trial" : "开始免费试用"}<ArrowRight size={15} aria-hidden="true" /></Link>
    </section> : null}

    <section className="upgrade-plans" aria-label={en ? "Plan selection" : "版本选择"}>
      <article className="upgrade-plan upgrade-plan--free rise" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="upgrade-plan__head">
          <div><p className="upgrade-plan__kicker">01 · {en ? "Explore" : "探索阶段"}</p><h2>Free</h2><p>{en ? "Find the first credible opportunity before committing to delivery." : "先把机会看清楚，再决定是否进入交付。"}</p></div>
          <span className="upgrade-plan__price"><b className="upgrade-plan__amount">¥0</b><i className="upgrade-plan__unit">{en ? "free to start" : "免费开始"}</i></span>
        </div>
        <div className="upgrade-plan__signal"><Search size={17} aria-hidden="true" /><span>{en ? "Best for opportunity discovery" : "适合先做机会判断"}</span></div>
        <ul className="upgrade-feature-list">{freeFeatures.map((feature) => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <div className="upgrade-plan__footer"><Link href="/account" className="btn btn--ghost">{en ? "Continue with Free" : "继续使用 Free"}<ArrowRight size={15} aria-hidden="true" /></Link><p>{en ? "No card required · start immediately" : "无需绑卡 · 立即开始"}</p></div>
      </article>

      <article className="upgrade-plan upgrade-plan--pro rise" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="upgrade-plan__head">
          <div><p className="upgrade-plan__kicker">02 · {en ? "Execute" : "执行阶段"}</p><h2>Pro</h2><p>{en ? "Turn a promising opportunity into a validation package your team can act on." : "把有潜力的机会推进成团队可以执行的验证方案。"}</p></div>
          <span className="upgrade-plan__price"><b className="upgrade-plan__amount">¥99</b><i className="upgrade-plan__unit">{en ? "/ 3 rounds" : "/ 3 轮"}</i></span>
        </div>
        <div className="upgrade-plan__signal"><Layers3 size={17} aria-hidden="true" /><span>{en ? "Deeper reasoning and more deliverables" : "更深推理与完整交付链路"}</span></div>
        <ul className="upgrade-feature-list">{proFeatures.map((feature) => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <div className="upgrade-plan__footer">
          {owned.length ? <div className="upgrade-project-picker"><span>{en ? "Choose a project to view its quote" : "选择项目查看对应报价"}</span><div>{owned.map((project) => <Link key={project.id} href={`/p/${accountProjectToken(project.id)}#pro`} className="upgrade-project-link">{project.productName}<ArrowRight size={14} aria-hidden="true" /></Link>)}</div></div> : null}
          <Link href={session ? "/account" : "/projects/new"} className="btn btn--primary">{en ? "Choose a project" : "选择出海项目"}<ArrowRight size={15} aria-hidden="true" /></Link>
          <p>{en ? "Three paid rounds in addition to the trial · no automatic renewal" : "试用后再含三轮完整验证 · 无自动续费"}</p>
        </div>
      </article>
    </section>

    <section className="upgrade-comparison rise" style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="upgrade-comparison-title">
      <div className="upgrade-section-head"><div><p className="upgrade-plan__kicker">{en ? "At a glance" : "一眼看懂"}</p><h2 id="upgrade-comparison-title">{en ? "Free and Pro performance comparison" : "Free 与 Pro 性能差异对比"}</h2></div><p>{en ? "One product, one target market. The project page confirms the scope and price before payment." : "适用于一个产品、一个目标市场。付款前在项目页确认服务范围与价格，无需申请审批。"}</p></div>
      <div className="upgrade-comparison__table" role="table">
        <div className="upgrade-comparison__row upgrade-comparison__row--head" role="row"><div role="columnheader">{en ? "Capability" : "能力维度"}</div><div role="columnheader">Free</div><div role="columnheader">Pro</div></div>
        {comparison.map((row) => <div className="upgrade-comparison__row" role="row" key={row.label}><div className="upgrade-comparison__label" role="rowheader">{row.label}</div><div role="cell">{row.free}</div><div role="cell">{row.pro}</div></div>)}
      </div>
    </section>

    <aside className="upgrade-cost-note rise" style={{ "--i": 4 } as React.CSSProperties}>
      <Sparkles size={18} aria-hidden="true" />
      <div><strong>{en ? "What counts as one round" : "一轮完整验证包含什么"}</strong><p>{en ? "Each round includes positioning, an English validation page, one channel plan and a growth review. Revisions and system retries within a round do not use another round. You confirm positioning, publishing and each new paid round." : "每轮都有定位方案、英文验证页、单渠道行动方案和增长复盘。同轮修改与系统失败重试不扣次数，定位、公开发布和开启下一轮均由你确认。"}</p></div>
      <span>{en ? "1 free + 3 paid rounds" : "1 轮免费试用 + 3 轮付费验证"}</span>
    </aside>

    <section className="upgrade-process rise" style={{ "--i": 5 } as React.CSSProperties} aria-label={en ? "How the plans work" : "版本使用流程"}>
      <div className="upgrade-process__step"><span><Clock3 size={17} aria-hidden="true" /></span><div><strong>1 · {en ? "Explore" : "先探索"}</strong><p>{en ? "Submit your product and get the opportunity report." : "提交产品，先获得出海机会报告。"}</p></div></div>
      <div className="upgrade-process__line" aria-hidden="true" />
      <div className="upgrade-process__step"><span><Layers3 size={17} aria-hidden="true" /></span><div><strong>2 · {en ? "Select" : "再选择"}</strong><p>{en ? "Claim one full round free without signing in." : "报告完成后，免登录领取一轮完整试用。"}</p></div></div>
      <div className="upgrade-process__line" aria-hidden="true" />
      <div className="upgrade-process__step"><span><Sparkles size={17} aria-hidden="true" /></span><div><strong>3 · {en ? "Validate" : "进入验证"}</strong><p>{en ? "After the trial, buy three additional rounds if you want to continue." : "看完试用结果，再决定是否购买后续三轮。"}</p></div></div>
    </section>
  </main><SceneFooter /></div>;
}
