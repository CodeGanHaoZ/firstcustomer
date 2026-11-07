import { desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { getCustomerSession } from "@/lib/customer-auth";
import { accountProjectToken } from "@/lib/customer-project";
import { formatDateTime } from "@/lib/format";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "我的项目 · 首客 HiFirst", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");

  const owned = await getDb().select({
    id: projects.id, productName: projects.productName, status: projects.status,
    paused: projects.paused, updatedAt: projects.updatedAt,
  }).from(projects).where(eq(projects.customerId, session.user.id)).orderBy(desc(projects.updatedAt));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="首客首页"><BrandMark /></Link>
        <form action={signOutAction}><Button type="submit" variant="outline">退出登录</Button></form>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">我的项目</h1>
          <p className="mt-2 text-sm break-all text-muted-foreground">{session.user.email}</p>
        </div>
        <Link href="/#cta" className={buttonVariants({ size: "lg" })}>新建出海项目</Link>
      </header>
      {owned.length ? (
        <ul className="divide-y rounded-xl border bg-card">
          {owned.map((project) => (
            <li key={project.id}>
              <Link href={`/p/${accountProjectToken(project.id)}`} className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-secondary sm:px-6">
                <span className="grid min-w-0 gap-1">
                  <strong className="wrap-break-word">{project.productName}</strong>
                  <span className="text-xs text-muted-foreground">{formatDateTime(project.updatedAt)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  {project.paused ? "已暂停" : STATUS_LABELS[project.status as ProjectStatus] ?? project.status}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-xl border bg-card px-5 py-8 text-sm text-muted-foreground">还没有项目。新建一个出海项目，就可以开始免费初诊。</p>}
    </main>
  );
}
