"use client";

import { useLocale } from "./locale-provider";
import { ExpandableOffice } from "./expandable-office";
import { DEPARTMENTS } from "@/domain/office";
import type { OfficeStation } from "./office-map";

export function IntakeAgentRail({ busy, ready }: { busy: boolean; ready: boolean }) {
  const en = useLocale() === "en";
  const stations: OfficeStation[] = DEPARTMENTS.map(({ key, duty }) => ({
    key, detail: duty, state: key === "frontdesk" && busy ? "running" : "idle",
  }));
  return <ExpandableOffice stations={stations} focusRoom="frontdesk" ambientHandoffs
    title={busy ? en ? "Organizing your brief" : "正在整理需求" : ready ? en ? "Brief ready" : "需求已整理" : en ? "At reception" : "接待中"}
    detail={busy ? en ? "Reading your latest message" : "理解你刚补充的内容" : ready ? en ? "Waiting for your confirmation" : "等你确认后开始研究" : en ? "Waiting for your next message" : "等待你的补充"} />;
}
