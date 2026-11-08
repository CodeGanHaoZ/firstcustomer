"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Check, ChevronDown, ListChecks, PackageCheck, Radar,
  Rocket, ScanSearch, Search, Sparkles, Table2, Workflow,
} from "lucide-react";

type Dimension = {
  icon: LucideIcon;
  label: string;
  free: string;
  pro: string;
  freeScore: number;
  proScore: number;
  freeDetails: string[];
  proDetails: string[];
};

type Stage = { tag: string; title: string; items: string[] };

type Copy = {
  kicker: string;
  title: string;
  lead: string;
  tabs: [string, string, string];
  hint: string;
  colDim: string;
  detailTitle: string;
  foldFree: string;
  foldPro: string;
  foldAside: string;
  foldCount: string;
  stats: { value: string; label: string }[];
  dims: Dimension[];
  radarTitle: string;
  radarNote: string;
  radarPick: string;
  radarShorts: [string, string, string, string, string];
  legendFree: string;
  legendPro: string;
  coverage: string;
  deliverTitle: string;
  deliverNote: string;
  stages: Stage[];
};

const I18N: { zh: Copy; en: Copy } = {
  zh: {
    kicker: "一眼看懂",
    title: "Free 与 Pro 能力差异对比",
    lead: "适用于一个产品、一个目标市场。付款前在项目页确认服务范围与价格，无需申请审批。",
    tabs: ["逐项对比", "能力雷达", "交付清单"],
    hint: "点击任一维度，展开查看该能力的具体细节",
    colDim: "能力维度",
    detailTitle: "能力细节",
    foldFree: "Free 内含",
    foldPro: "Pro 追加",
    foldAside: "按版本分列，与上方 Free / Pro 逐列对应",
    foldCount: "项明细",
    stats: [
      { value: "5", label: "个能力维度" },
      { value: "25", label: "项能力细节" },
      { value: "4", label: "类交付物 / 轮" },
      { value: "3", label: "轮完整验证" },
    ],
    dims: [
      {
        icon: Search, label: "研究深度", free: "出海机会扫描", pro: "机会扫描 + 定位与战略综合判断",
        freeScore: 38, proScore: 90,
        freeDetails: ["产品信息与目标市场初筛", "候选细分人群与需求假设"],
        proDetails: ["竞品坐标与差异化定位判断", "把结论串成可执行的验证策略", "定位方案随轮次迭代收敛"],
      },
      {
        icon: Workflow, label: "AI 工作链路", free: "标准分析队列", pro: "基于证据的定位判断和完整验证链路",
        freeScore: 32, proScore: 94,
        freeDetails: ["标准分析队列按序输出", "单轮结论附来源引用"],
        proDetails: ["多角色接力：研究 → 定位 → 页面 → 增长", "结论评价与人工原文复核分开处理", "同轮修改与失败重试不消耗轮次"],
      },
      {
        icon: ScanSearch, label: "证据与搜索", free: "候选人群、支持/反面证据、待验证问题", pro: "当前项目的扩展市场证据与海外搜索",
        freeScore: 42, proScore: 92,
        freeDetails: ["候选人群与支持 / 反面证据", "待验证问题清单"],
        proDetails: ["扩展检索与海外来源补证", "保存来源版本快照与 SHA-256 校验", "待验证问题随轮次逐步收敛"],
      },
      {
        icon: PackageCheck, label: "交付内容", free: "出海机会报告", pro: "三轮定位方案、英文验证页、渠道行动方案与增长复盘",
        freeScore: 30, proScore: 96,
        freeDetails: ["一份出海机会报告", "候选人群与待验证问题汇总"],
        proDetails: ["定位方案：细分人群、价值主张、竞争坐标", "英文验证页 + 单渠道行动方案", "增长复盘：数据回读与下一步建议"],
      },
      {
        icon: Rocket, label: "执行方式", free: "帮助你决定下一步验证什么", pro: "免费试用一轮；付款后再开通三轮完整验证",
        freeScore: 35, proScore: 88,
        freeDetails: ["帮助你决定下一步验证什么", "无需登录即可开始第一轮分析"],
        proDetails: ["免费试用一轮 + ¥99 三轮完整验证，无自动续费", "定位、公开发布与开启下一轮均由你确认", "项目页随时查看服务范围、轮次与报价"],
      },
    ],
    radarTitle: "能力覆盖雷达",
    radarNote: "按 5 个能力维度的交付深度绘制，刻度为示意值，用于直观比较覆盖范围。",
    radarPick: "点选轴标签查看该维度明细",
    radarShorts: ["研究深度", "工作链路", "证据搜索", "交付内容", "执行方式"],
    legendFree: "Free · 基础覆盖",
    legendPro: "Pro · 完整交付",
    coverage: "覆盖深度",
    deliverTitle: "从一份报告，到三轮完整验证",
    deliverNote: "同轮修改与系统失败重试不扣次数；定位、公开发布和开启下一轮均由你确认。",
    stages: [
      { tag: "FREE", title: "机会报告", items: ["出海机会扫描", "候选细分人群", "支持 / 反面证据", "待验证问题"] },
      { tag: "第 1 轮", title: "定位与首版页面", items: ["定位方案", "英文验证页", "渠道行动方案", "增长复盘"] },
      { tag: "第 2 轮", title: "验证迭代", items: ["定位方案修订", "英文验证页 A/B", "渠道行动方案", "增长复盘"] },
      { tag: "第 3 轮", title: "复盘与决策", items: ["定位方案收敛", "英文验证页定稿", "渠道行动方案", "增长复盘"] },
    ],
  },
  en: {
    kicker: "At a glance",
    title: "Free and Pro capability comparison",
    lead: "One product, one target market. The project page confirms the scope and price before payment.",
    tabs: ["Side by side", "Capability radar", "Deliverables"],
    hint: "Select any dimension to expand its capability details",
    colDim: "Capability",
    detailTitle: "Capability details",
    foldFree: "Included in Free",
    foldPro: "Adds in Pro",
    foldAside: "Grouped by plan, matching the Free / Pro columns above",
    foldCount: "details",
    stats: [
      { value: "5", label: "capability areas" },
      { value: "25", label: "detailed capabilities" },
      { value: "4", label: "deliverables / round" },
      { value: "3", label: "full validation rounds" },
    ],
    dims: [
      {
        icon: Search, label: "Research depth", free: "Opportunity scan", pro: "Opportunity scan + strategic synthesis",
        freeScore: 38, proScore: 90,
        freeDetails: ["Product brief parsing and market screening", "Candidate segments and demand hypotheses"],
        proDetails: ["Competitive map and differentiation", "A validation strategy you can act on", "Positioning refined round by round"],
      },
      {
        icon: Workflow, label: "AI workflow", free: "Standard analysis queue", pro: "Evidence-backed positioning and a complete validation workflow",
        freeScore: 32, proScore: 94,
        freeDetails: ["Standard queue, sequential output", "Single-round conclusions with citations"],
        proDetails: ["Role relay: research → positioning → page → growth", "Conclusion review and source verification stay separate", "Revisions and retries never consume a round"],
      },
      {
        icon: ScanSearch, label: "Evidence and search", free: "Candidate audiences, evidence and open questions", pro: "Expanded market evidence and overseas search for the active project",
        freeScore: 42, proScore: 92,
        freeDetails: ["Candidate audiences, supporting / counter evidence", "A list of open questions"],
        proDetails: ["Extended retrieval and overseas source checks", "Saved source snapshots with SHA-256 verification", "Open questions narrow down round by round"],
      },
      {
        icon: PackageCheck, label: "Deliverables", free: "Opportunity report", pro: "Three rounds of positioning, English pages, channel plans and growth reviews",
        freeScore: 30, proScore: 96,
        freeDetails: ["One opportunity report", "Audience and open-question summary"],
        proDetails: ["Positioning: segments, value proposition, competitive map", "English page + single-channel action plan", "Growth review: data readback and next steps"],
      },
      {
        icon: Rocket, label: "Execution", free: "Decide what to validate next", pro: "One free trial round; three additional rounds after payment verification",
        freeScore: 35, proScore: 88,
        freeDetails: ["Decide what to validate next", "Start the first analysis without signing in"],
        proDetails: ["One free round + ¥99 for three rounds, no auto-renewal", "You confirm positioning, publishing and each new round", "Scope, rounds and pricing always visible in the project"],
      },
    ],
    radarTitle: "Capability coverage radar",
    radarNote: "Plotted by delivery depth across five capability areas. The scale is indicative, for comparing coverage at a glance.",
    radarPick: "Select an axis label to inspect that capability",
    radarShorts: ["Research", "Workflow", "Evidence", "Deliverables", "Execution"],
    legendFree: "Free · baseline coverage",
    legendPro: "Pro · complete delivery",
    coverage: "Coverage depth",
    deliverTitle: "From one report to three full validation rounds",
    deliverNote: "Revisions and system retries within a round never consume another round. You confirm positioning, publishing and each new paid round.",
    stages: [
      { tag: "FREE", title: "Opportunity report", items: ["Opportunity scan", "Candidate segments", "Supporting / counter evidence", "Open questions"] },
      { tag: "ROUND 1", title: "Positioning & first page", items: ["Positioning plan", "English validation page", "Channel action plan", "Growth review"] },
      { tag: "ROUND 2", title: "Validation iteration", items: ["Revised positioning", "English page A/B", "Channel action plan", "Growth review"] },
      { tag: "ROUND 3", title: "Review & decision", items: ["Final positioning", "Final English page", "Channel action plan", "Growth review"] },
    ],
  },
};

const CX = 198;
const CY = 150;
const R = 100;

function radarPoint(index: number, value: number): [number, number] {
  const angle = ((-90 + index * 72) * Math.PI) / 180;
  const radius = (R * value) / 100;
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

function radarPolygon(values: number[]): string {
  return values.map((value, index) => radarPoint(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
}

const GRID_RINGS = [25, 50, 75, 100];

export function PlanComparison({ en }: { en: boolean }) {
  const c = en ? I18N.en : I18N.zh;
  const [view, setView] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const [axis, setAxis] = useState(0);
  const [showFree, setShowFree] = useState(true);
  const [showPro, setShowPro] = useState(true);

  const freeScores = c.dims.map((d) => d.freeScore);
  const proScores = c.dims.map((d) => d.proScore);
  const active = c.dims[axis];
  const ActiveIcon = active.icon;
  const tabIcons: LucideIcon[] = [Table2, Radar, ListChecks];

  return <>
    <div className="upgrade-section-head">
      <div><p className="upgrade-plan__kicker">{c.kicker}</p><h2 id="upgrade-comparison-title">{c.title}</h2></div>
      <p>{c.lead}</p>
    </div>

    <div className="pc-stats" aria-label={c.title}>
      {c.stats.map((stat) => <div className="pc-stat" key={stat.label}>
        <b>{stat.value}</b><span>{stat.label}</span>
      </div>)}
    </div>

    <div className="pc-tabs" role="tablist" aria-label={c.title}>
      <span className="pc-tabs__indicator" style={{ "--tab": view } as CSSProperties} aria-hidden="true" />
      {c.tabs.map((tab, index) => {
        const Icon = tabIcons[index];
        return <button key={tab} type="button" role="tab" aria-selected={view === index}
          aria-controls={`pc-panel-${index}`} id={`pc-tab-${index}`}
          className={`pc-tab${view === index ? " is-active" : ""}`} onClick={() => setView(index)}>
          <Icon size={15} aria-hidden="true" />{tab}
        </button>;
      })}
    </div>

    {view === 0 ? <div className="pc-panel" id="pc-panel-0" role="tabpanel" aria-labelledby="pc-tab-0" key="matrix">
      <p className="pc-hint"><Sparkles size={14} aria-hidden="true" />{c.hint}</p>
      <div className="pc-matrix" role="table" aria-label={c.tabs[0]}>
        <div className="pc-matrix__head" role="row">
          <div role="columnheader">{c.colDim}</div><div role="columnheader">Free</div><div role="columnheader">Pro</div>
        </div>
        {c.dims.map((dim, index) => {
          const Icon = dim.icon;
          const expanded = open === index;
          return <div className={`pc-dim${expanded ? " is-open" : ""}`} role="row" key={dim.label}>
            <button type="button" className="pc-dim__trigger" aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : index)}>
              <span className="pc-dim__label" role="rowheader">
                <span className="pc-dim__icon"><Icon size={16} aria-hidden="true" /></span>
                <span className="pc-dim__name"><i>{String(index + 1).padStart(2, "0")}</i>{dim.label}</span>
                <ChevronDown size={15} className="pc-dim__chev" aria-hidden="true" />
              </span>
              <span className="pc-dim__cell" role="cell">
                <span className="pc-dim__text">{dim.free}</span>
                <span className="pc-dim__meter"><span className="pc-bar pc-bar--free" style={{ "--v": `${dim.freeScore}%`, "--i": index } as CSSProperties}><i /></span><b>{dim.freeScore}</b></span>
              </span>
              <span className="pc-dim__cell pc-dim__cell--pro" role="cell">
                <span className="pc-dim__text">{dim.pro}</span>
                <span className="pc-dim__meter"><span className="pc-bar pc-bar--pro" style={{ "--v": `${dim.proScore}%`, "--i": index } as CSSProperties}><i /></span><b>{dim.proScore}</b></span>
              </span>
            </button>
            {/* 展开区与上方三列使用同一套栅格，Free / Pro 细节各自归列，竖线逐列贯通 */}
            <div className="pc-dim__fold"><div className="pc-dim__fold-inner"><div className="pc-dim__fold-grid">
              <div className="pc-dim__fold-aside">
                <p className="pc-dim__fold-title"><BarChart3 size={14} aria-hidden="true" />{c.detailTitle}</p>
                <span>{c.foldAside}</span>
                <span className="pc-dim__fold-count"><b>{dim.freeDetails.length + dim.proDetails.length}</b> {c.foldCount}</span>
              </div>
              <div className="pc-dim__fold-col">
                <p className="pc-dim__fold-colhead"><i aria-hidden="true" />{c.foldFree}</p>
                <ul>{dim.freeDetails.map((detail, i) => <li key={detail} style={{ "--i": i } as CSSProperties}>
                  <span className="pc-dim__dot" aria-hidden="true" /><span>{detail}</span>
                </li>)}</ul>
              </div>
              <div className="pc-dim__fold-col pc-dim__fold-col--pro">
                <p className="pc-dim__fold-colhead pc-dim__fold-colhead--pro"><i aria-hidden="true" />{c.foldPro}</p>
                <ul>{dim.proDetails.map((detail, i) => <li key={detail} style={{ "--i": i } as CSSProperties}>
                  <span className="pc-dim__dot" aria-hidden="true" /><span>{detail}</span>
                </li>)}</ul>
              </div>
            </div></div></div>
          </div>;
        })}
      </div>
    </div> : null}

    {view === 1 ? <div className="pc-panel" id="pc-panel-1" role="tabpanel" aria-labelledby="pc-tab-1" key="radar">
      <div className="pc-radar-layout">
        <div className="pc-radar-card">
          <div className="pc-radar-card__head"><h3>{c.radarTitle}</h3><p>{c.radarNote}</p></div>
          <svg className="pc-radar" viewBox="0 0 396 310" role="img" aria-label={c.radarTitle}>
            <defs>
              <linearGradient id="pcSweep" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#b4883f" stopOpacity=".3" />
                <stop offset="100%" stopColor="#b4883f" stopOpacity="0" />
              </linearGradient>
            </defs>
            {GRID_RINGS.map((ring) => <polygon key={ring} className="pc-radar__grid" points={radarPolygon([ring, ring, ring, ring, ring])} />)}
            {c.dims.map((_, i) => {
              const [x, y] = radarPoint(i, 100);
              return <line key={i} className="pc-radar__axis" x1={CX} y1={CY} x2={x} y2={y} />;
            })}
            <g className="pc-radar__sweep" aria-hidden="true">
              <path d={`M ${CX} ${CY} L ${CX + R} ${CY} A ${R} ${R} 0 0 1 ${(CX + R * Math.cos(Math.PI / 3)).toFixed(1)} ${(CY + R * Math.sin(Math.PI / 3)).toFixed(1)} Z`} fill="url(#pcSweep)" />
            </g>
            <polygon className={`pc-radar__shape pc-radar__shape--free${showFree ? "" : " is-hidden"}`} points={radarPolygon(freeScores)} />
            <polygon className={`pc-radar__shape pc-radar__shape--pro${showPro ? "" : " is-hidden"}`} points={radarPolygon(proScores)} />
            {proScores.map((value, i) => {
              const [x, y] = radarPoint(i, value);
              return <circle key={i} className={`pc-radar__vertex pc-radar__vertex--pro${showPro ? "" : " is-hidden"}`} cx={x} cy={y} r="4" />;
            })}
            {freeScores.map((value, i) => {
              const [x, y] = radarPoint(i, value);
              return <circle key={i} className={`pc-radar__vertex pc-radar__vertex--free${showFree ? "" : " is-hidden"}`} cx={x} cy={y} r="3" />;
            })}
            {c.dims.map((dim, i) => {
              const [x, y] = radarPoint(i, 120);
              const anchor = x > CX + 12 ? "start" : x < CX - 12 ? "end" : "middle";
              return <text key={dim.label} x={x} y={y + 4} textAnchor={anchor}
                className={`pc-radar__label${axis === i ? " is-active" : ""}`}
                onClick={() => setAxis(i)}>{c.radarShorts[i]}</text>;
            })}
          </svg>
          <div className="pc-radar__legend">
            <button type="button" className={showFree ? "is-on" : ""} onClick={() => setShowFree(!showFree)} aria-pressed={showFree}>
              <i className="pc-swatch pc-swatch--free" />{c.legendFree}
            </button>
            <button type="button" className={showPro ? "is-on" : ""} onClick={() => setShowPro(!showPro)} aria-pressed={showPro}>
              <i className="pc-swatch pc-swatch--pro" />{c.legendPro}
            </button>
          </div>
        </div>
        <div className="pc-radar-detail">
          <p className="pc-radar-detail__hint">{c.radarPick}</p>
          <div className="pc-radar-axis">
            {c.dims.map((dim, i) => <button key={dim.label} type="button"
              className={`pc-radar-axis__item${axis === i ? " is-active" : ""}`} onClick={() => setAxis(i)}>
              <span>{String(i + 1).padStart(2, "0")}</span>{dim.label}
            </button>)}
          </div>
          <div className="pc-radar-detail__card" key={axis}>
            <div className="pc-radar-detail__title"><ActiveIcon size={18} aria-hidden="true" /><h3>{active.label}</h3></div>
            <div className="pc-radar-detail__score">
              <div><span>Free</span><b>{active.freeScore}</b>
                <span className="pc-bar pc-bar--free" style={{ "--v": `${active.freeScore}%`, "--i": 0 } as CSSProperties}><i /></span>
                <p>{active.free}</p>
              </div>
              <div><span>Pro</span><b>{active.proScore}</b>
                <span className="pc-bar pc-bar--pro" style={{ "--v": `${active.proScore}%`, "--i": 1 } as CSSProperties}><i /></span>
                <p>{active.pro}</p>
              </div>
            </div>
            <p className="pc-radar-detail__sub">{c.coverage} · {c.detailTitle}</p>
            <div className="pc-radar-detail__cols">
              <div>
                <p className="pc-radar-detail__colhead"><i aria-hidden="true" />{c.foldFree}</p>
                <ul>{active.freeDetails.map((detail) => <li key={detail}><Check size={13} aria-hidden="true" />{detail}</li>)}</ul>
              </div>
              <div>
                <p className="pc-radar-detail__colhead pc-radar-detail__colhead--pro"><i aria-hidden="true" />{c.foldPro}</p>
                <ul>{active.proDetails.map((detail) => <li key={detail}><Check size={13} aria-hidden="true" />{detail}</li>)}</ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div> : null}

    {view === 2 ? <div className="pc-panel" id="pc-panel-2" role="tabpanel" aria-labelledby="pc-tab-2" key="deliver">
      <div className="pc-deliver__head"><h3>{c.deliverTitle}</h3><p>{c.deliverNote}</p></div>
      <div className="pc-timeline">
        {c.stages.map((stage, i) => <div className={`pc-stage${i === 0 ? " pc-stage--free" : ""}`} key={stage.tag} style={{ "--i": i } as CSSProperties}>
          <div className="pc-stage__marker"><span>{i === 0 ? <Search size={15} aria-hidden="true" /> : i}</span></div>
          <div className="pc-stage__card">
            <p className="pc-stage__tag">{stage.tag}</p>
            <h4>{stage.title}</h4>
            <ul>{stage.items.map((item) => <li key={item}><Check size={13} aria-hidden="true" />{item}</li>)}</ul>
          </div>
        </div>)}
      </div>
    </div> : null}
  </>;
}
