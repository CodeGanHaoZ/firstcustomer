"use client";

import { ArrowDown, ArrowRight, ArrowUpRight, Check, CircleAlert, Focus, LoaderCircle, UserRound } from "lucide-react";
import { characterDisplayName } from "@/lib/brand";
import { getOfficeMembers } from "@/lib/office-showcase";
import type { OfficeGuide } from "@/domain/office-guide";
import type { DepartmentKey } from "@/domain/office";
import type { Locale } from "@/lib/locale";
import type { CSSProperties } from "react";

export function OfficeWorkGuide({ guide, locale, onFocus, hrefPrefix = "" }: { guide: OfficeGuide; locale: Locale; onFocus: (room: DepartmentKey) => void; hrefPrefix?: string }) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const member = getOfficeMembers(locale).find((item) => item.key === guide.room);
  const label = {
    working: t("正在工作", "Working now"), queued: t("已排队", "Queued"), waiting: t("等待确认 / 数据", "Waiting for a decision or data"),
    action: t("需要你处理", "Your action is needed"), complete: t("本步已完成", "Stage complete"), failed: t("需要处理", "Needs attention"), paused: t("已暂停", "Paused"), closed: t("已结束", "Closed"),
  }[guide.state];
  const nextName = guide.nextActor === "customer" ? t("你 · 项目发起人", "You · Project owner") : guide.nextActor ? characterDisplayName(guide.nextActor, locale) : null;
  return <section className="office-work-guide" data-state={guide.state} aria-label={t("现在做什么，接下来做什么", "What is happening now and what comes next")}>
    <div className="office-guide-current">
      {member ? <button type="button" className="office-guide-avatar" onClick={() => onFocus(member.key)} aria-label={t(`定位 ${member.name} 的当前工位`, `Locate ${member.name}’s desk`)}
        style={{ "--portrait-x": `${member.portrait[0] * 100 / 3}%`, "--portrait-y": `${member.portrait[1] * 100}%` } as CSSProperties}><Focus size={17} aria-hidden="true" /></button> : <span className="office-guide-person"><UserRound size={30} aria-hidden="true" /></span>}
      <div className="office-guide-task">
        <span className="office-guide-status">{guide.state === "working" ? <LoaderCircle size={15} aria-hidden="true" /> : guide.state === "complete" ? <Check size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />}{label}</span>
        <h3>{guide.title}</h3>
        <p>{guide.task}</p>
        <p className="office-guide-output"><strong>{t("本步产物", "This stage delivers")}</strong>{guide.output}</p>
      </div>
    </div>
    {guide.next ? <div className="office-guide-next"><ArrowDown size={18} aria-hidden="true" /><div><span>{t("接下来", "Up next")}{nextName ? <> · <strong>{nextName}</strong></> : null}</span><h4>{guide.next}</h4>{guide.condition ? <p>{guide.condition}</p> : null}</div></div> : null}
    <div className="office-guide-your-turn"><UserRound size={18} aria-hidden="true" /><p><strong>{t("你现在需要做", "What you need to do")}</strong>{guide.yourAction}</p>
      {guide.link ? <a href={`${hrefPrefix}${guide.link.href}`}>{guide.link.label}<ArrowUpRight size={15} aria-hidden="true" /></a> : member ? <button type="button" onClick={() => onFocus(member.key)}>{t("定位当前工位", "Find the current desk")}<ArrowRight size={15} aria-hidden="true" /></button> : null}
    </div>
  </section>;
}
