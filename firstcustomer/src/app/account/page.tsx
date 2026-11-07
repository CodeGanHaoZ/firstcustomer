import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, Info, Plus } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
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

export async function generateMetadata(): Promise<Metadata> {
  const [locale, session] = await Promise.all([getLocale(), getCustomerSession()]);
  return { title: translateUi(locale, session ? "我的项目 · 首客 HiFirst" : "试用工作台 · 首客 HiFirst"), robots: { index: false, follow: false } };
}

export default async function AccountPage() {
  const [session, tokens] = await Promise.all([getCustomerSession(), trialProjectTokens()]);
  const db = getDb();
  const [owned, trial] = await Promise.all([session ? db.select({
    id: projects.id, productName: projects.productName, status: projects.status,
    paused: projects.paused, updatedAt: projects.updatedAt,
  }).from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt)) : Promise.resolve([]),
  listTrialProjects(db, tokens)]);
  const visible = [...owned.map((project) => ({ ...project, token: accountProjectToken(project.id) })), ...trial]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="site-shell">
      <SiteHeader current="account" />
      <main className="site-main">
        <PageHead
          eyebrow={session ? <span className="normal-case tracking-normal">{session.user.email}</span> : <T>无需登录</T>}
          title={<T>{session ? "我的项目" : "试用工作台"}</T>}
          lead={session ? undefined : <T>无需登录，直接创建项目，查看办公室进度与出海机会报告。</T>}
          actions={visible.length ? <Link href="/#cta" className="btn btn--primary btn--lg"><Plus size={16} aria-hidden="true" /><T>新建出海项目</T></Link> : undefined}
        />
        {!session ? (
          <div className="notice rise" style={{ "--i": 1 } as CSSProperties}>
            <Info size={16} aria-hidden="true" />
            <p className="m-0"><T>当前浏览器会保留最近 12 个试用项目的入口，保存 30 天。清除浏览器数据后，请通过项目专属链接找回。</T>{" "}
              <Link href="/register" className="link-u"><T>注册或登录后，这些试用项目会保存到你的账号，方便换设备继续。</T></Link></p>
          </div>
        ) : trial.length ? (
          <form action={saveTrialProjectsAndReturnAction} className="notice notice--wait rise flex-wrap items-center justify-between" style={{ "--i": 1 } as CSSProperties}>
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
            <Link href="/#cta" className="btn btn--primary"><T>新建出海项目</T><ArrowRight size={14} className="arw" aria-hidden="true" /></Link>
          </div>
        )}
      </main>
      <SceneFooter />
    </div>
  );
}
