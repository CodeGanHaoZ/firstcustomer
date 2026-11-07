import { z } from "zod";
import { KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES } from "./types";

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export const knowledgeContentSchema = z.object({
  title: z.string().trim().min(2, "标题至少 2 个字").max(100, "标题最多 100 字"),
  category: z.enum(Object.keys(KNOWLEDGE_CATEGORIES) as [keyof typeof KNOWLEDGE_CATEGORIES, ...Array<keyof typeof KNOWLEDGE_CATEGORIES>]),
  content: z.string().trim().min(10, "正文至少 10 个字").max(12000, "正文最多 12000 字"),
  visibility: z.enum(["public", "internal"]),
  agents: z.array(z.enum(Object.keys(KNOWLEDGE_AGENTS) as [keyof typeof KNOWLEDGE_AGENTS, ...Array<keyof typeof KNOWLEDGE_AGENTS>]))
    .min(1, "至少选择一位使用资料的 Agent").max(9).transform((items) => [...new Set(items)]),
  sourceUrl: z.string().trim().max(2000).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }, "来源链接须为不含账号密码的 HTTP 或 HTTPS 地址"),
  sourceNote: z.string().trim().max(500, "来源说明最多 500 字"),
  reviewedOn: z.string().refine(validDate, "请选择有效的核对日期"),
  expiresOn: z.string().refine((value) => !value || validDate(value), "请选择有效的到期日期"),
}).superRefine((value, ctx) => {
  if (value.visibility === "internal" && value.agents.includes("lumi")) {
    ctx.addIssue({ code: "custom", path: ["visibility"], message: "首页 Lumi 只能使用公开资料，请调整可见范围或取消勾选 Lumi" });
  }
  if (value.expiresOn && value.expiresOn < value.reviewedOn) {
    ctx.addIssue({ code: "custom", path: ["expiresOn"], message: "到期日期不能早于核对日期" });
  }
});
