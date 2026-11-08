import type { CSSProperties } from "react";
import { demoMember } from "@/lib/office-showcase";
import { getLocale } from "@/lib/locale-server";
import type { DepartmentKey } from "@/domain/office";

/** 工作台内容栏的「经手 Agent」署名：小肖像 + 名字 + 职责，纸感虚线胶囊。 */
export async function AgentByline({ person }: { person: DepartmentKey }) {
  const locale = await getLocale();
  const member = demoMember(person, locale);
  // 职责取「·」后的中文名，避免「Research · 市场研究」这类双语堆叠把胶囊撑得过长。
  const shortRole = member.role.includes("·") ? member.role.split("·").pop()!.trim() : member.role;
  return <p className="agent-byline">
    <span className="agent-byline__portrait" data-person={person} aria-hidden="true" style={{
      "--portrait-x": `${member.portrait[0] * 100 / 3}%`, "--portrait-y": `${member.portrait[1] * 100}%`,
    } as CSSProperties} />
    <span className="agent-byline__name">{member.name}</span>
    <span className="agent-byline__role">{shortRole}</span>
  </p>;
}
