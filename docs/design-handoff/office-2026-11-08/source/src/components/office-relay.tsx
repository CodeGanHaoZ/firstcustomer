import { ArrowRight, FileText, UserRound } from "lucide-react";
import type { RefObject } from "react";
import type { Locale } from "@/lib/locale";
import { demoMember, getOfficeMembers, type DemoScene } from "@/lib/office-showcase";
import { officeStory } from "@/lib/office-story";
import { OfficePortrait } from "./office-portrait";

export function OfficeRelay({ scene, scenes, sceneIndex, phase, locale, progress, onChoose }: {
  scene: DemoScene; scenes: readonly DemoScene[]; sceneIndex: number; phase: number; locale: Locale;
  progress: RefObject<HTMLSpanElement | null>; onChoose: (index: number) => void;
}) {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const story = officeStory(sceneIndex, locale);
  const sender = demoMember(scene.from, locale);
  const receiver = demoMember(scene.to, locale);
  const members = getOfficeMembers(locale);
  return <>
    <section className="office-relay" data-phase={phase} aria-label={t("本段协作的交接与分工", "The teammates and deliverable in this scene")}>
      <header className="relay-heading"><span className="relay-scene-number" aria-label={t(`协作片段 ${sceneIndex + 1} / 6`, `Scene ${sceneIndex + 1} of 6`)}>{String(sceneIndex + 1).padStart(2, "0")}<small>/ 06</small></span><h3>{scene.title}</h3></header>
      <div className="relay-exchange">
        {[sender, receiver].map((member, index) => <div className="relay-party" key={`${sceneIndex}-${member.key}`} data-current={index === (phase >= 3 ? 1 : 0)}>
          <div className="relay-person"><OfficePortrait person={member.key} locale={locale} /><div><span className="relay-person-state">{index === 0 ? phase >= 4 ? t("完成交接", "Handed over") : t("本步负责", "Handling this stage") : phase >= 3 ? t("已经接手", "Taking it forward") : t("下一位伙伴", "Up next")}</span><h4>{member.name}</h4><p>{member.room}</p></div></div>
          <blockquote>{scene.lines[index]}</blockquote>
        </div>)}
        <div className="relay-transfer">
          <span className="relay-transfer-label">{t("交接成果", "The handoff")}</span>
          <div className="relay-transfer-rail" aria-hidden="true"><span /><ArrowRight size={18} /></div>
          <div className="relay-document"><FileText size={27} strokeWidth={1.5} aria-hidden="true" /><strong>{scene.document}</strong></div>
          <span className="relay-transfer-state">{phase >= 3 ? t("接收后，继续下一步", "Received. The next task follows.") : t("带着依据，交给下一位", "Evidence travels with the work.")}</span>
        </div>
      </div>
      <div className="relay-decision"><UserRound size={20} aria-hidden="true" /><p><strong>{t("流程中，你来决定", "Your part in the process")}</strong><span>{story.action}</span></p></div>
      <div className="relay-scene-progress" aria-hidden="true"><span ref={progress} /></div>
    </section>
    <div className="relay-chapter-heading"><h4>{t("六段协作，点开看看", "Explore six team handoffs")}</h4><span>{t("选择片段，办公室会同步演示", "Choose a scene to see it in the office")}</span></div>
    <nav className="relay-chapters" aria-label={t("选择办公室协作片段", "Choose an office collaboration scene")}>
      {scenes.map((item, index) => <button key={index} type="button" onClick={() => onChoose(index)} aria-label={`${index + 1} ${item.chapter}`} aria-current={sceneIndex === index ? "step" : undefined}>
        <span className="relay-chapter-node"><OfficePortrait person={members.find((member) => member.scene === index)?.key ?? item.from} locale={locale} /><span>{String(index + 1).padStart(2, "0")}</span></span>
        <strong>{item.chapter}</strong><span className="relay-chapter-cast">{demoMember(item.from, locale).name.split(" ")[0]}<ArrowRight size={12} aria-hidden="true" />{demoMember(item.to, locale).name.split(" ")[0]}</span>
        <span className="relay-chapter-artifact">{item.document}</span>
      </button>)}
    </nav>
  </>;
}
