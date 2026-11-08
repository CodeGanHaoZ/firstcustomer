import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, RefreshCw } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusPill } from "@/components/site-chrome";
import { T } from "@/components/ui-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { AGENT_LABELS } from "@/domain/office";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatYuan } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { loadOwnerDashboard, OWNER_CATEGORIES } from "@/workflow/owner-dashboard";
import "./owner.css";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: `${translateUi(await getLocale(), "老板经营台")} · HiFirst`, robots: { index: false, follow: false } };
}
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

export default async function OwnerPage({ searchParams }: PageProps<"/admin/owner">) {
  await requireAdmin("workspace.read", "/admin/owner");
  const params = await searchParams;
  const category = Object.hasOwn(OWNER_CATEGORIES, one(params.category)) ? one(params.category) as keyof typeof OWNER_CATEGORIES : "all";
  const query = one(params.q).trim().slice(0, 100);
  const data = await loadOwnerDashboard(getDb());
  const filtered = data.queue.filter((item) => category === "all" || item.category === category);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.max(1, Math.min(pageCount, Math.floor(Number(one(params.page))) || 1));
  const running = data.taskCounts.find((item) => item.status === "running")?.total ?? 0;
  const failed = data.projects.filter((project) => project.status === "failed").length;
  const active = data.projects.filter((project) => !["cancelled", "delivered", "free_ready"].includes(project.status)).length;
  const matchingProjects = data.projects.filter((project) => project.productName.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const projectPageCount = Math.max(1, Math.ceil(matchingProjects.length / 12));
  const projectPage = Math.max(1, Math.min(projectPageCount, Math.floor(Number(one(params.projectPage))) || 1));
  const pageHref = (next: number) => `/admin/owner?category=${category}&page=${next}&q=${encodeURIComponent(query)}#owner-inbox`;

  return <main className="admin-section owner-console">
    <AutoRefresh seconds={30} />
    <header className="admin-section-heading">
      <div><h1><T>老板经营台</T></h1><p><T>查看项目与交付，核对实收，处理经营异常。</T></p></div>
      <div className="owner-header-actions">
        <Link href="/admin"><T>进入办公室</T><ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link href="/admin/owner"><RefreshCw size={14} aria-hidden="true" /><T>刷新数据</T></Link>
      </div>
    </header>
    {one(params.error) ? <p role="alert" className="notice notice--fail"><T>{one(params.error)}</T></p> : null}
    {one(params.notice) ? <p role="status" className="notice"><T>{one(params.notice)}</T></p> : null}

    <dl className="owner-figures">
      <div><dt><T>待我决定</T></dt><dd>{data.queue.length}<small><T>件</T></small></dd><p><T>超过 24 小时</T> {data.overdue} <T>件</T></p></div>
      <div><dt><T>外部客户实收</T></dt><dd>{formatYuan(data.metrics.revenueFen)}</dd><p><T>已付款订单</T> {data.metrics.paid}</p></div>
      <div><dt><T>客户已接受，待收款</T></dt><dd>{formatYuan(data.pendingPaymentFen)}</dd><p><T>未计入收入</T></p></div>
      <div><dt><T>客户有效线索</T></dt><dd>{data.metrics.growth.leads}<small><T>条</T></small></dd><p><T>排除测试线索与自有产品</T></p></div>
    </dl>

    <div className="owner-main-grid">
      <section id="owner-inbox" className="owner-panel" aria-labelledby="owner-inbox-title">
        <div className="owner-section-title"><h2 id="owner-inbox-title"><T>决策收件箱</T></h2><span className="meta"><T>超时与风险优先</T></span></div>
        <nav className="owner-filters" aria-label="待办分类">
          {Object.entries(OWNER_CATEGORIES).map(([key, label]) => <Link key={key} href={`/admin/owner?category=${key}#owner-inbox`}
            aria-current={category === key ? "page" : undefined}><T>{label}</T><span>{data.counts[key as keyof typeof OWNER_CATEGORIES]}</span></Link>)}
        </nav>
        {filtered.length ? <ul className="owner-inbox">
          {filtered.slice((page - 1) * 12, page * 12).map((item) => <li key={item.id}>
            <div className="owner-item-body">
              <div className="owner-item-flags"><span className="pill pill--line"><T>{OWNER_CATEGORIES[item.category]}</T></span>
                {item.overdue ? <span className="owner-overdue"><T>超过 24 小时</T></span> : null}
                {item.isOwnProduct ? <span className="meta"><T>自有产品</T></span> : null}</div>
              <h3>{item.title}</h3><p><T>{item.action}</T></p>
              {item.since ? <time className="meta" dateTime={item.since.toISOString()}>{formatDateTime(item.since)} <T>起等待处理</T></time> : null}
            </div>
            <Link className="owner-action-link" href={item.href}>
              <T>{item.category === "payment" ? "核对到账" : "查看并处理"}</T><ArrowRight size={16} aria-hidden="true" />
            </Link>
          </li>)}
        </ul> : <div className="owner-empty"><Check size={24} aria-hidden="true" /><h3><T>当前没有这类待办</T></h3><p><T>新的审批会随项目进展出现在这里。</T></p></div>}
        {pageCount > 1 ? <nav className="owner-pagination" aria-label="待办分页">
          {page > 1 ? <Link href={pageHref(page - 1)}><T>上一页</T></Link> : <span />}
          <span>{page} / {pageCount}</span>{page < pageCount ? <Link href={pageHref(page + 1)}><T>下一页</T></Link> : <span />}
        </nav> : null}
      </section>

      <aside className="owner-aside">
        <section className="owner-panel" aria-labelledby="owner-health-title">
          <div className="owner-section-title"><h2 id="owner-health-title"><T>运行与成本</T></h2><Link href="/admin/tasks"><T>任务板</T></Link></div>
          <dl className="owner-kv">
            <div><dt><T>推进中的项目</T></dt><dd>{active}</dd></div>
            <div><dt><T>运行中的任务</T></dt><dd>{running}</dd></div>
            <div><dt><T>运行超过 30 分钟</T></dt><dd>{data.coo.stalled.length}</dd></div>
            <div><dt><T>当前失败项目</T></dt><dd>{failed}</dd></div>
            <div><dt><T>模型标价费用</T></dt><dd>¥{data.metrics.modelCost.toFixed(2)}</dd></div>
            <div><dt><T>未计价任务</T></dt><dd>{data.metrics.unpricedTasks}</dd></div>
            <div><dt><T>老板人工分钟</T></dt><dd>{data.metrics.founderMinutes}</dd></div>
          </dl>
          <p className="meta"><T>费用与人工为全公司累计；模型标价不等于实际账单。</T></p>
          {data.coo.stalled.length ? <ul className="owner-small-list">{data.coo.stalled.slice(0, 5).map((task) => <li key={task.id}>
            <Link href={`/admin/projects/${task.projectId}#task-${task.id}`}>{task.productName} · <T>{AGENT_LABELS[task.agent] ?? task.agent}</T></Link>
            <span className="meta"><T>请检查执行记录</T></span>
          </li>)}</ul> : null}
        </section>
        <section className="owner-panel" aria-labelledby="owner-waiting-title">
          <div className="owner-section-title"><h2 id="owner-waiting-title"><T>等客户处理</T></h2><span>{data.waiting.length}</span></div>
          {data.waiting.length ? <ul className="owner-small-list">{data.waiting.slice(0, 5).map((item) => <li key={item.id}>
            <Link href={item.href}>{item.title}</Link><span className="meta"><T>{item.action}</T></span>
          </li>)}</ul> : <p className="meta"><T>没有等待客户确认的事项。</T></p>}
          {data.waiting.length > 5 ? <Link href="/admin#waiting"><T>查看全部待客户事项</T></Link> : null}
        </section>
        <p className="owner-payment-setting"><T>{data.paymentCodeReady ? "收款码已配置" : "收款码尚未配置"}</T><Link href="/admin/payment"><T>{data.paymentCodeReady ? "管理收款设置" : "去配置"}</T><ArrowRight size={14} aria-hidden="true" /></Link></p>
      </aside>
    </div>

    <section className="owner-panel" aria-labelledby="owner-projects-title">
      <div className="owner-section-title"><h2 id="owner-projects-title"><T>项目与订单</T> <span className="meta">{matchingProjects.length}</span></h2><Link href="/admin/metrics"><T>完整经营报表</T><ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      <form className="owner-search" action="/admin/owner">
        <label htmlFor="owner-search"><T>查找项目</T></label><Input id="owner-search" name="q" defaultValue={query} maxLength={100} type="search" />
        <Button type="submit" variant="outline"><T>搜索</T></Button>{query ? <Link href="/admin/owner"><T>清除</T></Link> : null}
      </form>
      <ul className="owner-project-list">
        {matchingProjects.slice((projectPage - 1) * 12, projectPage * 12).map((project) => <li key={project.id}>
          <div><Link className="owner-project-title" href={`/admin/projects/${project.id}`}>{project.productName}<ArrowUpRight size={14} aria-hidden="true" /></Link>
            <p className="meta"><T>{project.testAccount ? "测试账号" : project.isOwnProduct ? "自有产品" : "外部客户"}</T> · <T>{project.productPlan === "legacy" ? "项目服务" : project.productPlan.toUpperCase()}</T> · {formatDateTime(project.updatedAt)}</p></div>
          <StatusPill status={project.status} paused={project.paused} label={project.paused ? "已暂停" : STATUS_LABELS[project.status as ProjectStatus] ?? project.status} />
          <div className="owner-project-money"><span><T>报价</T> {project.quoteFen === null ? "—" : formatYuan(project.quoteFen)}</span>
            <span className="meta"><T>{project.paymentMode === "simulated" ? "模拟支付 · 不计实收" : project.orderStatus === "trial_active" ? "免费试用 · 不计实收" : project.orderStatus === "key_activated" ? "密钥开通 · 无实收" : "实收"}</T>{project.paymentMode === "simulated" || ["key_activated", "trial_active"].includes(project.orderStatus ?? "") ? "" : ` ${formatYuan(project.receivedFen)}`}</span></div>
          <Link href={`/admin/audit?project=${project.id}`} className="owner-record-link"><T>决策记录</T></Link>
        </li>)}
      </ul>
      {!matchingProjects.length ? <div className="owner-empty"><h3><T>{query ? "没有匹配的项目" : "还没有项目"}</T></h3><p><T>{query ? "换一个关键词，或清除搜索查看全部项目。" : "新建首个项目后，任务、报价与收款会汇总到这里。"}</T></p><Link href={query ? "/admin/owner" : "/admin/projects/new"}><T>{query ? "查看全部项目" : "新建项目"}</T></Link></div> : null}
      {projectPageCount > 1 ? <nav className="owner-pagination" aria-label="项目分页">
        {projectPage > 1 ? <Link href={`/admin/owner?q=${encodeURIComponent(query)}&projectPage=${projectPage - 1}#owner-projects-title`}><T>上一页</T></Link> : <span />}
        <span>{projectPage} / {projectPageCount}</span>{projectPage < projectPageCount ? <Link href={`/admin/owner?q=${encodeURIComponent(query)}&projectPage=${projectPage + 1}#owner-projects-title`}><T>下一页</T></Link> : <span />}
      </nav> : null}
    </section>
    <footer className="owner-footnote"><p><T>累计数据 · 北京时间</T> {formatDateTime(new Date())}<T> · 每 30 秒刷新，填写表单时暂停刷新</T></p><Link href="/admin/audit"><T>查看决策与操作记录</T><ArrowRight size={14} aria-hidden="true" /></Link></footer>
  </main>;
}
