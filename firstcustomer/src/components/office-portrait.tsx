import type { CSSProperties } from "react";
import { demoMember } from "@/lib/office-showcase";
import type { DepartmentKey } from "@/domain/office";
import type { Locale } from "@/lib/locale";

export function OfficePortrait({ person, locale }: { person: DepartmentKey; locale: Locale }) {
  const member = demoMember(person, locale);
  return <span className="office-mini-portrait" data-person={person} aria-hidden="true" style={{
    "--portrait-x": `${member.portrait[0] * 100 / 3}%`, "--portrait-y": `${member.portrait[1] * 100}%`,
  } as CSSProperties} />;
}
