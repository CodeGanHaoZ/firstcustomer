import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import { BrandMark } from "@/components/brand-mark";
import { EditorialMotion } from "@/components/editorial-motion";
import { LumiChat } from "@/components/lumi-chat";
import { OfficeShowcase } from "@/components/office-showcase";
import { LanguageSwitch } from "@/components/language-switch";
import { HOME_COPY } from "@/lib/home-copy";
import { getLocale } from "@/lib/locale-server";
import { localeTag } from "@/lib/locale";
import { getCustomerSession } from "@/lib/customer-auth";
import "./home.css";
import "./editorial.css";
import "./office-showcase.css";

const WORDMARK = "首客 HIFIRST";

export async function generateMetadata() {
  const locale = await getLocale();
  return locale === "en" ? { title: "HiFirst · Find your first overseas customers", description: HOME_COPY.en.hero.description }
    : { title: "首客 HiFirst", description: "帮中国创业者找到第一批真实海外客户的 MiMo AI 出海服务" };
}

export default async function Home() {
  const [session, locale] = await Promise.all([getCustomerSession(), getLocale()]);
  const copy = HOME_COPY[locale];
  return (
    <div className="home-page" lang={localeTag(locale)}>
      <header className="nav">
        <div className="nav__inner container">
          <Link href="/" className="nav__brand" aria-label={copy.nav.home}>
            <BrandMark />
          </Link>
          <nav className="nav__menu" aria-label={copy.nav.label}>
            <a href="#office" className="nav__link">{copy.nav.office}</a>
            <a href="#plans" className="nav__link">{copy.nav.plans}</a>
            <a href="#service-flow" className="nav__link">{copy.nav.flow}</a>
            <a href="#cta" className="nav__link">{copy.nav.start}</a>
            <Link href="/account" className="nav__link">{session ? copy.nav.account : copy.nav.trial}</Link>
            {!session ? <Link href="/login" className="nav__link nav__mobile-auth">{copy.nav.auth}</Link> : null}
          </nav>
          <div className="nav__actions">
            <LanguageSwitch locale={locale} />
            {!session ? (
              <Link href="/login" className="btn btn--ghost btn--sm">{copy.nav.auth}</Link>
            ) : null}
          </div>
          <button type="button" className="nav__toggle" data-nav-toggle aria-expanded="false" aria-label={copy.nav.menu}>
            <ArrowDown size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="top">
        {/* ---------- 首屏：左右分栏（左文案 / 右可点击的 Lumi 前台卡片），底部铺毛毡出海风景 ---------- */}
        <div className="hero-scene">
        <section className="hero container hero--split">
          <div className="hero__copy">
            <p className="eyebrow" data-reveal>{copy.hero.eyebrow}</p>
            <h1 className="display" data-reveal data-reveal-group="hero">
              {copy.hero.title}
            </h1>
            <p className="lead" data-reveal data-reveal-group="hero">
              {copy.hero.description}
            </p>
            <div className="hero__actions" data-reveal data-reveal-group="hero">
              <a href="#cta" className="btn btn--primary btn--lg">
                {copy.hero.cta} <ArrowRight size={16} className="arw" aria-hidden="true" />
              </a>
              <a href="#office" className="btn btn--ghost btn--lg">
                {copy.hero.office} <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
            <p className="meta" data-reveal>{copy.trialNote}</p>
          </div>

          <div className="hero__visual" data-reveal data-reveal-group="hero">
            <LumiChat locale={locale} />
          </div>
        </section>
        </div>

        {/* ---------- 数字条：进视口滚动计数 ---------- */}
        <section className="container section--tight" aria-label={copy.statsLabel}>
          <div className="stats">
            {copy.stats.map(({ value, unit, label }, index) => (
              <div className="stat" key={index} data-reveal data-reveal-group="stats">
                <b><span data-count={value}>0</span><small>{unit}</small></b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- 首客办公室：动态场景在上、六位 Agent 在下 ---------- */}
        <section className="section section--paper2" id="office" aria-labelledby="office-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow" data-reveal>OUR OFFICE</p>
              <h2 className="h2" id="office-title" data-reveal data-reveal-group="office-head">
                {copy.office.title}
              </h2>
              <p className="lead" data-reveal data-reveal-group="office-head">
                {copy.office.description}
              </p>
            </div>
            <OfficeShowcase locale={locale} />
          </div>
        </section>

        {/* ---------- Free 与 Pro：并列对卡公式 ---------- */}
        <section className="section" id="plans" aria-labelledby="plans-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow" data-reveal>PLANS</p>
              <h2 className="h2" id="plans-title" data-reveal data-reveal-group="plans-head">
                {copy.plans.title}
              </h2>
              <p className="lead" data-reveal data-reveal-group="plans-head">
                {copy.plans.description}
              </p>
            </div>
            <div className="split-pair" data-reveal>
              <div className="split-pair__item">
                <p className="eyebrow">FREE</p>
                <h3 className="h3">{copy.plans.freeTitle}</h3>
                <p className="meta">{copy.plans.freeDescription}</p>
                <Link href="/projects/new" className="split-pair__go">
                  {copy.plans.freeCta} <ArrowRight size={14} className="arw" aria-hidden="true" />
                </Link>
              </div>
              <div className="split-pair__item">
                <p className="eyebrow">PRO</p>
                <h3 className="h3">{copy.plans.proTitle}</h3>
                <p className="meta">{copy.plans.proDescription}</p>
                <Link href="/projects/new" className="split-pair__go">
                  {copy.plans.proCta} <ArrowRight size={14} className="arw" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 服务流程：编号索引行公式（整行 hover 反色） ---------- */}
        <section className="section section--paper2" id="service-flow" aria-labelledby="flow-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow" data-reveal>SERVICE FLOW</p>
              <h2 className="h2" id="flow-title" data-reveal data-reveal-group="flow-head">
                {copy.flow.title}
              </h2>
            </div>
            <ol className="index-list" data-reveal>
              {copy.flow.steps.map(([title, body], index) => (
                <li key={title}>
                  <div className="index-list__row">
                    <span className="index-list__no">{String(index + 1).padStart(2, "0")}</span>
                    <span className="index-list__body">
                      <span className="index-list__title">{title}</span>
                      <span className="index-list__meta">{body}</span>
                    </span>
                    <span className="index-list__tail" aria-hidden="true">
                      <span className="index-list__arrow">→</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="section-end" data-reveal>
              <BackToTop variant="text" locale={locale} />
            </div>
          </div>
        </section>

        {/* ---------- 服务边界：两栏栏线表 ---------- */}
        <section className="section" aria-labelledby="boundaries-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow" data-reveal>BOUNDARIES</p>
              <h2 className="h2" id="boundaries-title" data-reveal data-reveal-group="bound-head">
                {copy.boundaries.title}
              </h2>
              <p className="lead" data-reveal data-reveal-group="bound-head">
                {copy.boundaries.description}
              </p>
            </div>
            <ul className="boundaries" data-reveal>
              {copy.boundaries.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="section-end" data-reveal>
              <BackToTop variant="text" locale={locale} />
            </div>
          </div>
        </section>

        {/* ---------- 结语公式：字标底纹 + 反白圆盘 ---------- */}
        <section className="disc-band" id="cta" aria-labelledby="cta-title">
          <div className="wordmark-field" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => (
              <span key={i}>{WORDMARK}</span>
            ))}
          </div>
          <div className="disc-band__inner container">
            <p className="eyebrow">READY TO SELL ABROAD</p>
            <span className="disc" aria-hidden="true"></span>
            <div className="disc-band__stage">
              <p className="disc-type" id="cta-title">{copy.cta.firstLine}<br />{copy.cta.secondLine}</p>
            </div>
            <p className="disc-band__lead">
              {copy.cta.description}
            </p>
            <div className="disc-band__actions">
              <Link href="/projects/new" className="btn btn--primary btn--lg">
                {copy.hero.cta} <ArrowRight size={16} className="arw" aria-hidden="true" />
              </Link>
              {session ? (
                <Link href="/account" className="btn btn--ghost btn--lg">{copy.nav.account}</Link>
              ) : (
                <Link href="/register" className="btn btn--ghost btn--lg">
                  {copy.cta.register} <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ---------- 极简页脚 ---------- */}
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
              <li><a href="#service-flow">{copy.nav.flow}</a></li>
              <li><a href="#plans">{copy.nav.plans}</a></li>
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
        </div>
      </footer>

      {/* ---------- 交互层 + 悬浮回到顶部 ---------- */}
      <EditorialMotion key={locale} />
      <BackToTop variant="float" locale={locale} />
    </div>
  );
}
