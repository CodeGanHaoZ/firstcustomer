import { LocalizedLink, LocalizedTag } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitch } from "@/components/language-switch";
import { signOutAction } from "@/app/account/actions";
import { getCustomerSession } from "@/lib/customer-auth";
import { HOME_COPY } from "@/lib/home-copy";
import { getLocale } from "@/lib/locale-server";
import { getDb } from "@/db";
import { customerMembership } from "@/workflow/membership";

type NavKey = "account" | "new" | "project" | "auth";

/** 顶栏与工作台使用同一份有效账号权益，不把历史项目订单当作订阅。 */
export async function customerTier(userId: string): Promise<"pro" | "free"> {
  try {
    return (await customerMembership(getDb(), userId)).plan;
  } catch {
    return "free";
  }
}

/** 客户侧通用顶栏：与首页同一条吸顶纸感导航。 */
export async function SiteHeader({ current, extra }: { current?: NavKey; extra?: ReactNode }) {
  const session = await getCustomerSession();
  const tier = session ? await customerTier(session.user.id) : "free";
  return (
    <header className="nav nav--static site-nav">
      <div className="nav__inner container">
        <LocalizedLink href="/#top" className="nav__brand" aria-label="首客首页"><BrandMark /></LocalizedLink>
        <LocalizedTag as="nav" className="nav__menu" aria-label="主导航">
          <Link href="/" className="nav__link"><T>首页</T></Link>
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
            <div className="nav__user-menu">
              <span className="nav__user" title={session.user.email}>
                <span className="nav__user-email">{session.user.email}</span>
                <span className={tier === "pro" ? "nav__plan nav__plan--pro" : "nav__plan nav__plan--free"}>{tier === "pro" ? "Pro" : "Free"}</span>
              </span>
              <div className="nav__user-dropdown" role="menu">
                <form action={signOutAction}>
                  <button type="submit" className="nav__user-signout" role="menuitem"><T>退出登录</T></button>
                </form>
              </div>
            </div>
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

/** 全站统一页脚：品牌行 + 链接列 + 居中版权行，与首页同一套结构。 */
export async function SiteFooter() {
  const [session, locale] = await Promise.all([getCustomerSession(), getLocale()]);
  const copy = HOME_COPY[locale];
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__col">
          <div className="footer__brand-row">
            <BrandMark />
            <span className="footer__brand-sep" aria-hidden="true"></span>
            <span className="footer__powered">
              <span className="meta">Powered by</span>
              <Image
                src="/brand/mimo-logo.png"
                alt="MiMo AI"
                width={110}
                height={14}
                className="footer__mimo"
                unoptimized
              />
            </span>
          </div>
          <p className="meta" style={{ marginTop: "12px", maxWidth: "30em" }}>
            {copy.footer.privacy}{" "}
            {process.env.PRIVACY_CONTACT ? `${copy.footer.contact} ${process.env.PRIVACY_CONTACT}` : copy.footer.noContact}
          </p>
        </div>
        <div className="footer__col">
          <h4>{copy.footer.start}</h4>
          <ul>
            <li><Link href="/#service-flow">{copy.nav.flow}</Link></li>
            <li><Link href="/#plans">{copy.nav.plans}</Link></li>
            <li><Link href="/projects/new">{copy.footer.submit}</Link></li>
          </ul>
        </div>
        <div className="footer__col">
          <h4>{copy.footer.account}</h4>
          <ul>
            <li><Link href="/login">{copy.footer.login}</Link></li>
            <li><Link href="/register">{copy.footer.register}</Link></li>
            <li><Link href="/account">{session ? copy.nav.account : copy.nav.trial}</Link></li>
          </ul>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© 2026 首客 HiFirst</span>
        <span className="footer__divider" aria-hidden="true"></span>
        <span>© JUNCTION·涌现</span>
      </div>
    </footer>
  );
}

/** 页尾：首页首屏同一张毛毡风景，只露山河，接统一页脚。 */
export function SceneFooter({ low = false }: { low?: boolean }) {
  return (
    <>
      <div className={low ? "scene-foot scene-foot--low" : "scene-foot"} aria-hidden="true" />
      <SiteFooter />
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
