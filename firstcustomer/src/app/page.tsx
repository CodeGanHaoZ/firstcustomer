import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import { BrandMark } from "@/components/brand-mark";
import { EditorialMotion } from "@/components/editorial-motion";
import { LumiChat } from "@/components/lumi-chat";
import { OfficeShowcase } from "@/components/office-showcase";
import { getCustomerSession } from "@/lib/customer-auth";
import "./home.css";
import "./editorial.css";
import "./office-showcase.css";

const STEPS = [
  ["免费初诊", "提交后自动开始，整理候选人群和待验证项。"],
  ["选择 Pro", "看完初诊结果后，可申请 Pro 提案。接受报价并确认到账后，继续做定位和发布。"],
  ["确认方向", "老板把关并推荐，你来确认先卖给谁、验证什么。"],
  ["英文页面", "生成真实可访问的英文验证页。事实声明没有证据，程序不让送审。"],
  ["真实发布", "你确认后执行一项推广实验，记录发布链接。"],
  ["数据复盘", "先看真实回复，再看访问和留资。样本不够就如实写样本不足。"],
] as const;

const BOUNDARIES = [
  "不保证带来付费用户或收入",
  "不做群发私信、刷量或冒充用户",
  "没有数据就显示零，报名不算收入",
  "对外发布和预算支出都要你确认",
] as const;

const STATS = [
  { value: 6, unit: "位", label: "AI 员工同班" },
  { value: 6, unit: "步", label: "完整服务流程" },
  { value: 2, unit: "档", label: "Free 与 Pro" },
  { value: 1, unit: "次", label: "免费市场初诊" },
] as const;

const WORDMARK = "首客 HIFIRST";

export default async function Home() {
  const session = await getCustomerSession();
  return (
    <>
      <header className="nav">
        <div className="nav__inner container">
          <Link href="/" className="nav__brand" aria-label="首客首页">
            <BrandMark />
          </Link>
          <nav className="nav__menu" aria-label="官网导航">
            <a href="#office" className="nav__link">办公室</a>
            <a href="#plans" className="nav__link">版本</a>
            <a href="#service-flow" className="nav__link">服务流程</a>
            <a href="#cta" className="nav__link">开始</a>
          </nav>
          <div className="nav__actions">
            {session ? (
              <Link href="/account" className="btn btn--ghost btn--sm">我的项目</Link>
            ) : (
              <Link href="/login" className="btn btn--ghost btn--sm">登录 / 注册</Link>
            )}
          </div>
          <button type="button" className="nav__toggle" data-nav-toggle aria-expanded="false" aria-label="打开菜单">
            <ArrowDown size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="top">
        {/* ---------- 首屏：左右分栏（左文案 / 右可点击的 Lumi 前台卡片） ---------- */}
        <section className="hero container hero--split">
          <div className="hero__copy">
            <p className="eyebrow" data-reveal>HIFIRST · AI 出海办公室</p>
            <h1 className="display" data-reveal data-reveal-group="hero">
              你的产品，第一批海外客户在哪里？
            </h1>
            <p className="lead" data-reveal data-reveal-group="hero">
              告诉首客你在做什么。MiMo AI 出海团队帮你研究市场、找到细分用户、
              准备英文发布和增长实验，用真实反馈决定下一步。
            </p>
            <div className="hero__actions" data-reveal data-reveal-group="hero">
              <Link href="/projects/new" className="btn btn--primary btn--lg">
                开始免费初诊 <ArrowRight size={16} className="arw" aria-hidden="true" />
              </Link>
              <a href="#office" className="btn btn--ghost btn--lg">
                看看办公室 <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="hero__visual" data-reveal data-reveal-group="hero">
            <LumiChat />
          </div>
        </section>

        {/* ---------- 数字条：进视口滚动计数 ---------- */}
        <section className="container section--tight" aria-label="首客数字">
          <div className="stats" data-reveal>
            {STATS.map(({ value, unit, label }) => (
              <div className="stat" key={label}>
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
                首客办公室 · 演示
              </h2>
              <p className="lead" data-reveal data-reveal-group="office-head">
                从一次接待到一轮复盘，看看六位 AI 同事怎样一起工作。
              </p>
            </div>
            <OfficeShowcase />
          </div>
        </section>

        {/* ---------- Free 与 Pro：并列对卡公式 ---------- */}
        <section className="section" id="plans" aria-labelledby="plans-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow" data-reveal>PLANS</p>
              <h2 className="h2" id="plans-title" data-reveal data-reveal-group="plans-head">
                Free 与 Pro
              </h2>
              <p className="lead" data-reveal data-reveal-group="plans-head">
                适合已有可演示产品或 MVP、但还没有稳定海外用户的中国独立开发者和小团队。
              </p>
            </div>
            <div className="split-pair" data-reveal>
              <div className="split-pair__item">
                <p className="eyebrow">FREE</p>
                <h3 className="h3">Free · 市场初诊</h3>
                <p className="meta">提交项目，查看候选人群、初诊摘要和待验证项。</p>
                <Link href="/projects/new" className="split-pair__go">
                  开始初诊 <ArrowRight size={14} className="arw" aria-hidden="true" />
                </Link>
              </div>
              <div className="split-pair__item">
                <p className="eyebrow">PRO</p>
                <h3 className="h3">Pro · 出海验证</h3>
                <p className="meta">完整定位、英文验证页、渠道行动和增长复盘。初诊完成后可申请报价。</p>
                <Link href="/projects/new" className="split-pair__go">
                  先初诊再升级 <ArrowRight size={14} className="arw" aria-hidden="true" />
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
                服务流程
              </h2>
            </div>
            <ol className="index-list" data-reveal>
              {STEPS.map(([title, body], index) => (
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
              <BackToTop variant="text" />
            </div>
          </div>
        </section>

        {/* ---------- 服务边界：两栏栏线表 ---------- */}
        <section className="section" aria-labelledby="boundaries-title">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow" data-reveal>BOUNDARIES</p>
              <h2 className="h2" id="boundaries-title" data-reveal data-reveal-group="bound-head">
                服务边界
              </h2>
              <p className="lead" data-reveal data-reveal-group="bound-head">
                先说清楚不做什么，再谈做什么。
              </p>
            </div>
            <ul className="boundaries" data-reveal>
              {BOUNDARIES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="section-end" data-reveal>
              <BackToTop variant="text" />
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
              <p className="disc-type" id="cta-title">让第一批客户<br />找到你</p>
            </div>
            <p className="disc-band__lead">
              从一次免费初诊开始：候选人群、待验证项、英文验证页，全部基于可追溯的证据。
            </p>
            <div className="disc-band__actions">
              <Link href="/projects/new" className="btn btn--primary btn--lg">
                开始免费初诊 <ArrowRight size={16} className="arw" aria-hidden="true" />
              </Link>
              {session ? (
                <Link href="/account" className="btn btn--ghost btn--lg">我的项目</Link>
              ) : (
                <Link href="/register" className="btn btn--ghost btn--lg">
                  注册账号 <ArrowUpRight size={15} aria-hidden="true" />
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
              Pro 服务以项目工作台中确认的报价为准。
              我们只把你提交的信息用于交付和必要联系。
              {process.env.PRIVACY_CONTACT ? ` 联系方式 ${process.env.PRIVACY_CONTACT}。` : " 建立项目后可通过专属链接联系首客客服。"}
            </p>
          </div>
          <div className="footer__col">
            <h4>开始</h4>
            <ul>
              <li><a href="#service-flow">服务流程</a></li>
              <li><a href="#plans">版本</a></li>
              <li><Link href="/projects/new">提交项目</Link></li>
            </ul>
          </div>
          <div className="footer__col">
            <h4>账号</h4>
            <ul>
              <li><Link href="/login">登录</Link></li>
              <li><Link href="/register">注册</Link></li>
              <li><Link href="/account">我的项目</Link></li>
            </ul>
          </div>
        </div>
        <div className="container footer__bottom">
          <span>© 2026 首客 HiFirst</span>
        </div>
      </footer>

      {/* ---------- 交互层 + 悬浮回到顶部 ---------- */}
      <EditorialMotion />
      <BackToTop variant="float" />
    </>
  );
}
