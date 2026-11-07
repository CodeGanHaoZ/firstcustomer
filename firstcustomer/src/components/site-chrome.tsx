import { LocalizedLink, LocalizedTag } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitch } from "@/components/language-switch";
import { signOutAction } from "@/app/account/actions";
import { getCustomerSession } from "@/lib/customer-auth";

type NavKey = "account" | "new" | "project" | "auth";

/** 客户侧通用顶栏：与首页同一条吸顶纸感导航。 */
export async function SiteHeader({ current, extra }: { current?: NavKey; extra?: ReactNode }) {
  const session = await getCustomerSession();
  return (
    <header className="nav nav--static site-nav">
      <div className="nav__inner container">
        <LocalizedLink href="/" className="nav__brand" aria-label="首客首页"><BrandMark /></LocalizedLink>
        <LocalizedTag as="nav" className="nav__menu" aria-label="主导航">
          <Link href="/#office" className="nav__link"><T>办公室</T></Link>
          <Link href="/account" className="nav__link" aria-current={current === "account" ? "page" : undefined}>
            <T>{session ? "我的项目" : "试用工作台"}</T>
          </Link>
          <Link href="/projects/new" className="nav__link" aria-current={current === "new" ? "page" : undefined}><T>新建出海项目</T></Link>
        </LocalizedTag>
        <div className="nav__actions">
          {extra}
          <LanguageSwitch />
          {current === "auth" ? null : session ? (
            <form action={signOutAction} className="site-nav__form">
              <button type="submit" className="btn btn--ghost btn--sm"><T>退出登录</T></button>
            </form>
          ) : <Link href="/login" className="btn btn--ghost btn--sm"><T>登录 / 注册</T></Link>}
        </div>
      </div>
    </header>
  );
}

/** 页头：眉标 + 衬线大标题 + 引导语，右侧放操作。 */
export function PageHead({ eyebrow, title, lead, meta, actions }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head rise">
      <div className="page-head__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-head__title">{title}</h1>
        {lead ? <p className="page-head__lead">{lead}</p> : null}
        {meta ? <div className="page-head__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="page-head__actions">{actions}</div> : null}
    </header>
  );
}

/** 页尾：首页首屏同一张毛毡风景，只露山河，作为全站统一的收尾。 */
export function SceneFooter({ low = false }: { low?: boolean }) {
  return (
    <>
      <div className={low ? "scene-foot scene-foot--low" : "scene-foot"} aria-hidden="true" />
      <footer className="site-foot">
        <span>© 2026 首客 HiFirst</span>
        <span><Link href="/"><T>返回主页</T></Link></span>
      </footer>
    </>
  );
}

/** 状态 → 标签色调 */
export function statusTone(status: string, paused = false): "wait" | "ok" | "fail" | "live" | "" {
  if (paused) return "wait";
  if (status === "failed" || status === "cancelled") return "fail";
  if (status === "delivered" || status === "free_ready" || status === "published") return "ok";
  if (status.startsWith("awaiting") || status === "needs_info") return "wait";
  if (["researching", "drafting_quote", "reading_receipt", "strategizing", "preparing_page", "collecting", "reviewing"].includes(status)) return "live";
  return "";
}

export function StatusPill({ status, label, paused = false }: { status: string; label: string; paused?: boolean }) {
  const tone = statusTone(status, paused);
  return <span className={tone ? `pill pill--${tone}` : "pill"}><T>{label}</T></span>;
}
