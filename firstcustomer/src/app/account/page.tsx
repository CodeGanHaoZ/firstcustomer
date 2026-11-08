import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, Info, Plus } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead, SceneFooter, SiteHeader, StatusPill } from "@/components/site-chrome";
import { projectPhases } from "@/components/project-details";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { getCustomerSession } from "@/lib/customer-auth";
import { accountProjectToken } from "@/lib/customer-project";
import { formatDateTime } from "@/lib/format";
import { listTrialProjects, trialProjectTokens } from "@/lib/trial-projects";
import { saveTrialProjectsAndReturnAction } from "./actions";
import { customerMembership } from "@/workflow/membership";
import { customerPurchasedProjects, customerProTrial, guestProTrial } from "@/workflow/purchases";
import { currentProTrialVisitor } from "@/lib/pro-trial-visitor";

type AccountMembership = Awaited<ReturnType<typeof customerMembership>>;

const FREE_MEMBERSHIP: AccountMembership = {
  plan: "free",
  testAccount: false,
  source: "manual",
  expiresAt: null,
};

/**
 * Account pages are also used while a deployment is being upgraded. If the
 * application has already shipped but the optional account migrations have
 * not reached the database yet, a schema error should not turn the whole
 * customer workspace into a server error. Other database errors still throw
 * so outages are visible and do not get mistaken for an empty account.
 */
function isSchemaCompatibilityError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "42P01" || code === "42703" || code === "42883";
}

async function withAccountFallback<T>(label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    console.error(`[account] ${label} unavailable until database migrations finish`, error);
    return fallback;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, session] = await Promise.all([getLocale(), getCustomerSession()]);
  return { title: translateUi(locale, session ? "我的项目 · 首客 HiFirst" : "试用工作台 · 首客 HiFirst"), robots: { index: false, follow: false } };
}

export default async function AccountPage() {
  const [session, tokens] = await Promise.all([getCustomerSession(), trialProjectTokens()]);
  const db = getDb();
  const membership = await withAccountFallback(
    "membership",
    () => customerMembership(db, session?.user.id),
    FREE_MEMBERSHIP,
  );
  if (membership.plan === "pro") redirect("/account/pro");
  const [owned, trial, purchased, proTrial, browserTrial] = await Promise.all([
    withAccountFallback(
      "owned projects",
      () => session ? db.select({
        id: projects.id, productName: projects.productName, status: projects.status,
        paused: projects.paused, updatedAt: projects.updatedAt,
      }).from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt)) : Promise.resolve([]),
      [],
    ),
    withAccountFallback("trial projects", () => listTrialProjects(db, tokens), []),
    withAccountFallback("purchased projects", () => session ? customerPurchasedProjects(db, session.user.id) : Promise.resolve([]), []),
    customerProTrial(db, session?.user.id),
    guestProTrial(db, await currentProTrialVisitor()),
  ]);
  const trialReadyProject = owned.find((item) => item.status === "free_ready");
  const guestReadyProject = trial.find((item) => item.status === "free_ready");
  const visible = [...owned.map((project) => ({ ...project, token: accountProjectToken(project.id) })), ...trial]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="site-shell">
      <SiteHeader current="account" />
      <main className="site-main site-main--workspace">
        <PageHead
          eyebrow={session ? <span className="normal-case tracking-normal">{session.user.email}</span> : undefined}
          title={<T>{session ? "我的项目" : "试用工作台"}</T>}
          actions={visible.length ? <Link href="/projects/new" className="btn btn--primary btn--lg"><Plus size={16} aria-hidden="true" /><T>新建出海项目</T></Link> : undefined}
        />
        {session ? <section className="notice notice--row">
          <div><strong><T>{purchased.length ? "Pro · 项目权益" : "Free"}</T></strong><p className="m-0"><T>{purchased.length ? "已购买的项目可使用 Pro 模块，新项目可先免费分析出海机会。" : "免费分析出海机会。升级 Pro 后可使用定位、英文页面与增长复盘模块。"}</T></p></div>
          <Link href={purchased.length ? "/account/pro" : "/account/upgrade"} className="btn btn--primary btn--sm"><T>{purchased.length ? "进入 Pro 工作台" : "了解 Pro"}</T></Link>
        </section> : null}
        {(!session || proTrial.eligible) && !browserTrial ? <section className="notice notice--ok notice--row">
          <div><strong><T>新用户可免费体验 1 轮完整验证</T></strong><p className="m-0"><T>先查看免费报告，再领取定位、英文页、渠道方案和复盘试用，无需付款。</T></p></div>
          <Link className="btn btn--primary btn--sm" href={trialReadyProject ? `/p/${accountProjectToken(trialReadyProject.id)}#pro-trial` : guestReadyProject ? `/p/${guestReadyProject.token}#pro-trial` : "/projects/new"}><T>开始免费试用</T></Link>
        </section> : session && proTrial.claim?.projectId && !purchased.length ? <section className="notice notice--row">
          <div><strong><T>已领取 1 轮完整验证试用</T></strong><p className="m-0"><T>试用绑定领取时的项目，修改和失败重试无需重新领取。</T></p></div>
          <Link className="btn btn--primary btn--sm" href={`/p/${accountProjectToken(proTrial.claim.projectId)}`}><T>继续试用项目</T></Link>
        </section> : null}
        {!session ? (
          <details className="notice notice--fold rise" style={{ "--i": 1 } as CSSProperties}>
            <summary>
              <Info size={16} aria-hidden="true" />
              <span className="flex-1"><T>试用项目保存在本浏览器，30 天有效</T></span>
            </summary>
            <p className="m-0"><T>当前浏览器会保留最近 12 个试用项目的入口，保存 30 天。清除浏览器数据后，请通过项目专属链接找回。</T>{" "}
              <Link href="/register" className="link-u"><T>注册或登录后，这些试用项目会保存到你的账号，方便换设备继续。</T></Link></p>
          </details>
        ) : trial.length ? (
          <form action={saveTrialProjectsAndReturnAction} className="notice notice--wait notice--row rise" style={{ "--i": 1 } as CSSProperties}>
            <p className="m-0"><T>本浏览器还有试用项目，可以保存到当前账号。</T></p>
            <Button type="submit" size="sm"><T>保存试用项目到账号</T></Button>
          </form>
        ) : null}
        {visible.length ? (
          <ul className="card-grid">
            {visible.map((project, index) => {
              const status = project.status as ProjectStatus;
              const { phases, index: phaseIndex, done } = projectPhases(status, false, "legacy");
              const percent = done ? 100 : Math.max(8, Math.round(((Math.max(phaseIndex, 0) + 0.5) / phases.length) * 100));
              return (
                <li key={project.id} className="rise" style={{ "--i": Math.min(index + 2, 10) } as CSSProperties}>
                  <Link href={`/p/${project.token}`} className="tile h-full">
                    <p className="tile__meta">{formatDateTime(project.updatedAt)}</p>
                    <h2 className="tile__title">{project.productName}</h2>
                    <div className="meter" aria-hidden="true"><span style={{ "--p": `${percent}%`, "--i": index } as CSSProperties} /></div>
                    <div className="tile__foot">
                      <StatusPill status={status} paused={project.paused} label={project.paused ? "已暂停" : STATUS_LABELS[status] ?? project.status} />
                      <ArrowRight size={16} className="tile__arrow" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty rise" style={{ "--i": 2 } as CSSProperties}>
            <Image src="/brand/front-desk-rabbit.webp" alt="" width={132} height={132} unoptimized />
            <p><T>还没有项目。新建一个出海项目，就可以免费分析出海机会。</T></p>
            <Link href="/projects/new" className="btn btn--primary"><T>新建出海项目</T><ArrowRight size={14} className="arw" aria-hidden="true" /></Link>
          </div>
        )}
      </main>
      <SceneFooter />
    </div>
  );
}
