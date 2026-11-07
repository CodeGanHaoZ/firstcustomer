import { ArrowDown, ArrowRight } from "lucide-react";
import type { DepartmentKey } from "@/domain/office";
import type { Locale } from "@/lib/locale";
import { demoMember } from "@/lib/office-showcase";
import { OfficePortrait } from "./office-portrait";

const proTeam: DepartmentKey[] = ["frontdesk", "strategy", "launch", "launch", "growth"];

export function ServiceJourney({ steps, locale }: { steps: readonly (readonly [string, string])[]; locale: Locale }) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  return <div className="service-journey">
    <div className="journey-free">
      <div className="journey-plan">Free<span>{t("从这里开始", "Start here")}</span></div>
      <OfficePortrait person="research" locale={locale} />
      <div className="journey-free-copy"><span className="journey-step-no">01</span><h3>{steps[0][0]}</h3><p>{steps[0][1]}</p></div>
      <div className="journey-choice"><span>{t("看完报告，由你决定是否继续", "Read the report, then decide whether to continue")}</span><ArrowRight size={20} aria-hidden="true" /></div>
    </div>
    <div className="journey-pro"><div className="journey-pro-heading"><h3>Pro</h3><p>{t("让机会，走到真实验证。", "Take the opportunity into a real test.")}</p></div>
      <ol>{steps.slice(1).map(([title, body], index) => <li key={title}>
        <span className="journey-milestone" aria-hidden="true">{String(index + 2).padStart(2, "0")}</span>
        <OfficePortrait person={proTeam[index]} locale={locale} />
        <div><span className="journey-agent">{demoMember(proTeam[index], locale).name}</span><h4>{title}</h4><p>{body}</p></div>
        {index < steps.length - 2 ? <ArrowDown className="journey-next" size={15} aria-hidden="true" /> : null}
      </li>)}</ol>
    </div>
  </div>;
}
