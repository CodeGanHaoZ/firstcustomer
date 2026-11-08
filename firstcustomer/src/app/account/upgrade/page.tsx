import { ArrowRight, Check, Clock3, Layers3, Search, Sparkles } from "lucide-react";
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

type ComparisonRow = { label: string; free: string; pro: string };

export default async function UpgradePage() {
  const session = await getCustomerSession();
  if (session && (await customerMembership(getDb(), session.user.id)).plan === "pro") redirect("/account/pro");
  const en = (await getLocale()) === "en";
  const owned = session ? await getDb().select({ id: projects.id, productName: projects.productName, status: projects.status })
    .from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt)) : [];
  const comparison: ComparisonRow[] = en ? [
    { label: "Research depth", free: "Opportunity scan", pro: "Opportunity scan + strategic synthesis" },
    { label: "AI workflow", free: "Standard analysis queue", pro: "Flash for research and content, Pro reasoning for strategy" },
    { label: "Evidence and search", free: "Candidate audiences, evidence and open questions", pro: "Expanded market evidence and overseas search for the active project" },
    { label: "Deliverables", free: "Opportunity report", pro: "Positioning, English validation page, channel action plan and one growth review" },
    { label: "Execution", free: "Decide what to validate next", pro: "Agent team prepares the next validation steps after payment verification" },
  ] : [
    { label: "研究深度", free: "出海机会扫描", pro: "机会扫描 + 定位与战略综合判断" },
    { label: "AI 工作链路", free: "标准分析队列", pro: "研究与内容使用 Flash，战略环节使用 Pro 深度推理" },
    { label: "证据与搜索", free: "候选人群、支持/反面证据、待验证问题", pro: "当前项目的扩展市场证据与海外搜索" },
    { label: "交付内容", free: "出海机会报告", pro: "定位方案、英文验证页、渠道行动方案、一轮增长复盘" },
    { label: "执行方式", free: "帮助你决定下一步验证什么", pro: "付款校验后由 Agent 团队自动准备下一阶段验证" },
  ];

  const freeFeatures = en
    ? ["Opportunity report and candidate audiences", "Support and counter evidence with open questions", "No payment required to start the first analysis"]
    : ["出海机会报告与候选人群", "支持与反面证据，以及待验证问题", "无需付款即可开始第一轮分析"];
  const proFeatures = en
    ? ["A positioning and validation strategy", "An English validation page and channel action plan", "One growth review after real market feedback"]
    : ["定位与验证策略方案", "英文验证页与渠道行动方案", "获得真实市场反馈后进行一轮增长复盘"];

  return <div className="site-shell"><SiteHeader current="account" /><main className="site-main site-main--upgrade">
    <PageHead
      eyebrow={<span className="upgrade-eyebrow"><Sparkles size={15} aria-hidden="true" /> Free / Pro 工作台选择</span>}
      title={en ? "Choose the depth of your validation" : "选择适合你的验证深度"}
      lead={en ? "Start with a free opportunity scan, then add the Pro delivery modules when your project is ready to move from insight to market validation." : "先用 Free 找到机会，再在项目准备进入真实验证时开通 Pro 交付模块。两种版本的边界和性能差异都列在这里。"}
    />

    <section className="upgrade-plans" aria-label={en ? "Plan selection" : "版本选择"}>
      <article className="upgrade-plan upgrade-plan--free rise" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="upgrade-plan__head">
          <div><p className="upgrade-plan__kicker">01 · {en ? "Explore" : "探索阶段"}</p><h2>Free</h2><p>{en ? "Find the first credible opportunity before committing to delivery." : "先把机会看清楚，再决定是否进入交付。"}</p></div>
          <span className="upgrade-plan__price">¥0</span>
        </div>
        <div className="upgrade-plan__signal"><Search size={17} aria-hidden="true" /><span>{en ? "Best for opportunity discovery" : "适合先做机会判断"}</span></div>
        <ul className="upgrade-feature-list">{freeFeatures.map((feature) => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <div className="upgrade-plan__footer"><Link href="/account" className="btn btn--ghost">{en ? "Continue with Free" : "继续使用 Free"}<ArrowRight size={15} aria-hidden="true" /></Link><p>{en ? "No card required · start immediately" : "无需绑卡 · 立即开始"}</p></div>
      </article>

      <article className="upgrade-plan upgrade-plan--pro rise" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="upgrade-plan__ribbon">{en ? "For real validation" : "面向真实验证"}</div>
        <div className="upgrade-plan__head">
          <div><p className="upgrade-plan__kicker">02 · {en ? "Execute" : "执行阶段"}</p><h2>Pro</h2><p>{en ? "Turn a promising opportunity into a validation package your team can act on." : "把有潜力的机会推进成团队可以执行的验证方案。"}</p></div>
          <span className="upgrade-plan__price">{en ? "Per project" : "按项目"}</span>
        </div>
        <div className="upgrade-plan__signal"><Layers3 size={17} aria-hidden="true" /><span>{en ? "Deeper reasoning and more deliverables" : "更深推理与完整交付链路"}</span></div>
        <ul className="upgrade-feature-list">{proFeatures.map((feature) => <li key={feature}><Check size={16} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <div className="upgrade-plan__footer">
          {owned.length ? <div className="upgrade-project-picker"><span>{en ? "Choose a project to view its quote" : "选择项目查看对应报价"}</span><div>{owned.map((project) => <Link key={project.id} href={`/p/${accountProjectToken(project.id)}#pro`} className="upgrade-project-link">{project.productName}<ArrowRight size={14} aria-hidden="true" /></Link>)}</div></div> : null}
          <Link href={session ? "/account" : "/projects/new"} className="btn btn--primary">{en ? "Choose a project" : "选择出海项目"}<ArrowRight size={15} aria-hidden="true" /></Link>
          <p>{en ? "Quote appears after Free analysis · payment verified before execution" : "完成 Free 分析后显示项目报价 · 付款校验后开始执行"}</p>
        </div>
      </article>
    </section>

    <section className="upgrade-comparison rise" style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="upgrade-comparison-title">
      <div className="upgrade-section-head"><div><p className="upgrade-plan__kicker">{en ? "At a glance" : "一眼看懂"}</p><h2 id="upgrade-comparison-title">{en ? "Free and Pro performance comparison" : "Free 与 Pro 性能差异对比"}</h2></div><p>{en ? "The Pro price is calculated per project. AI resource cost is tracked separately from the service value." : "Pro 按项目计价；AI 资源成本与人工审核、交付价值分开记录，不把资源成本当作客户售价。"}</p></div>
      <div className="upgrade-comparison__table" role="table">
        <div className="upgrade-comparison__row upgrade-comparison__row--head" role="row"><div role="columnheader">{en ? "Capability" : "能力维度"}</div><div role="columnheader">Free</div><div role="columnheader">Pro</div></div>
        {comparison.map((row) => <div className="upgrade-comparison__row" role="row" key={row.label}><div className="upgrade-comparison__label" role="rowheader">{row.label}</div><div role="cell">{row.free}</div><div role="cell">{row.pro}</div></div>)}
      </div>
    </section>

    <aside className="upgrade-cost-note rise" style={{ "--i": 4 } as React.CSSProperties}>
      <Sparkles size={18} aria-hidden="true" />
      <div><strong>{en ? "How the Pro estimate is built" : "Pro 报价底座怎么计算"}</strong><p>{en ? "Research and content use MiMo Flash with batch processing where possible; positioning and growth review use MiMo Pro for deeper reasoning. A standard single-market project estimates about ¥3–4 in AI resource cost. This is an internal resource baseline, not the customer price; the project quote also covers review and delivery." : "资料解析和渠道内容尽量使用 MiMo Flash 与 Batch；定位战略和增长复盘使用 MiMo Pro 深度推理。标准单市场项目的 AI 资源成本估算约 ¥3–4，这只是内部资源底座，不是客户售价；项目报价还包含人工审核与交付价值。"}</p></div>
      <span>mimo-cn-2026-09-22</span>
    </aside>

    <section className="upgrade-process rise" style={{ "--i": 5 } as React.CSSProperties} aria-label={en ? "How the plans work" : "版本使用流程"}>
      <div className="upgrade-process__step"><span><Clock3 size={17} aria-hidden="true" /></span><div><strong>1 · {en ? "Explore" : "先探索"}</strong><p>{en ? "Submit your product and get the opportunity report." : "提交产品，先获得出海机会报告。"}</p></div></div>
      <div className="upgrade-process__line" aria-hidden="true" />
      <div className="upgrade-process__step"><span><Layers3 size={17} aria-hidden="true" /></span><div><strong>2 · {en ? "Select" : "再选择"}</strong><p>{en ? "Review the scope and quote on the project page." : "在项目页查看服务范围和项目报价。"}</p></div></div>
      <div className="upgrade-process__line" aria-hidden="true" />
      <div className="upgrade-process__step"><span><Sparkles size={17} aria-hidden="true" /></span><div><strong>3 · {en ? "Validate" : "进入验证"}</strong><p>{en ? "After payment verification, the Agent team starts the Pro modules." : "付款校验后，Agent 团队开始执行 Pro 模块。"}</p></div></div>
    </section>
  </main><SceneFooter /></div>;
}
