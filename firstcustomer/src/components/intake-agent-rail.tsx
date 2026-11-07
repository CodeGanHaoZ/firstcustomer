"use client";

import { ArrowRight, Check, CircleDashed, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DepartmentKey, OfficeTransfer } from "@/domain/office";
import { DEPARTMENTS } from "@/domain/office";
import { OfficeMap, type OfficeStation } from "@/components/office-map";
import { OfficeStage } from "@/components/office-stage";
import { OFFICE_CHARACTERS } from "@/lib/brand";
import { useLocale } from "@/components/locale-provider";

const FLOW: { key: DepartmentKey; task: string; output: string }[] = [
  { key: "frontdesk", task: "整理你的产品目标与限制", output: "需求卡" },
  { key: "research", task: "查找海外需求、竞品与反面证据", output: "出海机会报告" },
  { key: "strategy", task: "比较人群并写出验证方向", output: "定位方案" },
  { key: "launch", task: "准备英文验证页与渠道素材", output: "发布材料" },
  { key: "growth", task: "整理访问、留资与回复", output: "增长复盘" },
];

const MEMBER_NAMES: Record<DepartmentKey, string> = {
  frontdesk: OFFICE_CHARACTERS.frontdesk.name,
  research: OFFICE_CHARACTERS.research.name,
  strategy: OFFICE_CHARACTERS.strategy.name,
  finance: OFFICE_CHARACTERS.finance.name,
  launch: OFFICE_CHARACTERS.launch.name,
  growth: OFFICE_CHARACTERS.growth.name,
};

export function IntakeAgentRail({ messageCount, busy, ready, attachmentTier }: {
  messageCount: number;
  busy: boolean;
  ready: boolean;
  attachmentTier: "free" | "pro";
}) {
  const locale = useLocale();
  const [beat, setBeat] = useState(0);
  const [transfer, setTransfer] = useState<OfficeTransfer | null>(null);
  const phase = ready ? 1 : Math.min(FLOW.length - 1, Math.max(0, messageCount + (busy ? 1 : 0)) % FLOW.length);
  const current = FLOW[phase];

  useEffect(() => {
    const timer = window.setInterval(() => setBeat((value) => value + 1), 5200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (beat === 0) return;
    const previous = FLOW[(phase + FLOW.length - 1) % FLOW.length];
    const timer = window.setTimeout(() => setTransfer({ id: `intake-${phase}-${beat}`, from: previous.key, to: current.key, at: new Date().toISOString() }), 0);
    return () => window.clearTimeout(timer);
  }, [beat, current.key, phase]);

  const stations = useMemo<OfficeStation[]>(() => {
    const currentIndex = FLOW.findIndex((item) => item.key === current.key);
    return DEPARTMENTS.map(({ key, duty }) => {
      const index = FLOW.findIndex((item) => item.key === key);
      const state = key === current.key ? "running" : index >= 0 && index < currentIndex ? "completed" : index === currentIndex + 1 ? "scheduled" : "idle";
      return { key, state, detail: duty };
    });
  }, [current.key]);

  const zh = locale !== "en";
  return (
    <section className="lumi-guide-agent-rail" aria-label={zh ? "Agent 协作预览" : "Agent collaboration preview"}>
      <div className="lumi-guide-agent-rail__head">
        <div>
          <p className="eyebrow">{zh ? "AGENT RELAY" : "AGENT RELAY"}</p>
          <h2>{zh ? "不只 Lumi：办公室会一起推进" : "Lumi brings the office in"}</h2>
        </div>
        <span className="lumi-guide-agent-live"><i aria-hidden="true" />{zh ? "实时预览" : "Live preview"}</span>
      </div>
      <p className="lumi-guide-agent-rail__intro">
        {zh ? "对话由 Lumi 接待，研究、策略和增长伙伴会在确认后接手对应任务。" : "Lumi hosts the conversation. Research, strategy and growth take over after you confirm."}
      </p>
      <div className="lumi-guide-office">
        <OfficeStage transfer={transfer} customerView focusRoom={current.key}>
          <OfficeMap stations={stations} customerView />
        </OfficeStage>
      </div>
      <ol className="lumi-guide-agent-flow">
        {FLOW.map((item, index) => {
          const active = item.key === current.key;
          const done = index < phase;
          return (
            <li key={item.key} data-active={active} data-done={done}>
              <span className="lumi-guide-agent-flow__icon">{done ? <Check size={13} aria-hidden="true" /> : active && busy ? <LoaderCircle size={13} className="lumi-guide-spinner" aria-hidden="true" /> : <CircleDashed size={13} aria-hidden="true" />}</span>
              <span className="lumi-guide-agent-flow__copy"><strong>{MEMBER_NAMES[item.key]} · {item.task}</strong><small>{item.output}</small></span>
              {index < FLOW.length - 1 ? <ArrowRight size={13} aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
      <p className="lumi-guide-agent-tier">
        {attachmentTier === "pro"
          ? (zh ? "Pro 资料：可继续上传文档与多张图片，解析额度按 Pro 项目计费。" : "Pro materials: documents and larger image sets are available with Pro usage.")
          : (zh ? "Free 初诊：先用轻量资料找到值得验证的方向，确认后自动开始分析。" : "Free assessment: start with lightweight materials, then confirm to begin analysis.")}
      </p>
    </section>
  );
}
