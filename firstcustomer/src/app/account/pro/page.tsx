import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead, SceneFooter, SiteHeader } from "@/components/site-chrome";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { PRO_MODULES } from "@/domain/membership";
import { getCustomerSession } from "@/lib/customer-auth";
import { getLocale } from "@/lib/locale-server";
import { customerMembership } from "@/workflow/membership";
import { enterProModuleAction } from "../actions";

export const metadata = { title: "Pro 工作台 · 首客 HiFirst", robots: { index: false, follow: false } };

export default async function ProWorkspace({ searchParams }: PageProps<"/account/pro">) {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=%2Faccount%2Fpro");
  const db = getDb(); const membership = await customerMembership(db, session.user.id);
  if (membership.plan !== "pro") redirect("/account/upgrade");
  const [locale, query, owned] = await Promise.all([getLocale(), searchParams,
    db.select({ id: projects.id, productName: projects.productName, status: projects.status }).from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt))]);
  const en = locale === "en";
  const selected = owned.find((project) => project.id === query.project) ?? owned.find((project) => !["cancelled", "delivered"].includes(project.status)) ?? owned[0];
  return <div className="site-shell"><SiteHeader current="account" /><main className="site-main">
    <PageHead title={en ? "Pro workspace" : "Pro 工作台"} eyebrow={`Pro${membership.testAccount ? en ? " · Test account" : " · 测试账号" : ""}`}
      lead={en ? "Your Pro access is active. Enter your project modules without a preliminary quote or owner activation review." : "Pro 账号权益已开通，直接进入项目工作模块，无需初步报价和老板开通审核。"}
      actions={<Link href="/projects/new" className="btn btn--primary btn--lg">{en ? "Create a Pro project" : "新建 Pro 项目"}</Link>} />
    {membership.testAccount ? <p className="notice">{en ? "Test access only. This is not a payment or revenue record. Sample projects start only when you enter a module." : "此账号使用测试权益，不代表实际付款或收入。示例项目在你进入模块后才启动任务。"}</p> : null}
    {selected ? <>
      <section className="paper"><h2 className="paper__title">{en ? "Select a project" : "选择项目"}</h2><div className="mt-4 flex flex-wrap gap-2">{owned.map((project) => <Link key={project.id} href={`/account/pro?project=${project.id}#modules`} className={`btn btn--sm ${project.id === selected.id ? "btn--primary" : "btn--ghost"}`} aria-current={project.id === selected.id ? "true" : undefined}>{project.productName}</Link>)}</div></section>
      <section id="modules" className="mt-8"><h2 className="paper__title">{selected.productName}</h2><p className="meta">{en ? "Modules use this project's real records. New projects collect research before producing positioning and launch materials." : "各模块使用当前项目的真实记录。新项目先收集研究资料，再生成定位与发布内容。"}</p>
        <div className="card-grid mt-5">{PRO_MODULES.map((module) => <form key={module.key} action={enterProModuleAction.bind(null, selected.id, module.key)} className="tile">
          <h3 className="tile__title">{en ? module.en : module.zh}</h3><button type="submit" className="btn btn--primary btn--sm mt-4" disabled={["cancelled", "delivered"].includes(selected.status)}>{en ? "Enter module" : "进入模块"}</button>
        </form>)}</div>
      </section>
    </> : <section className="empty"><h2 className="paper__title">{en ? "Start your first Pro project" : "开始第一个 Pro 项目"}</h2><p>{en ? "Describe your product to Lumi Agent. Your existing Pro access is applied automatically." : "向 Lumi Agent 描述你的产品，创建后会自动使用已有 Pro 权益。"}</p><Link href="/projects/new" className="btn btn--primary">{en ? "Create project" : "创建项目"}</Link></section>}
  </main><SceneFooter /></div>;
}
