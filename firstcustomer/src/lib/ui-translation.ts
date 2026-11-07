import type { Locale } from "./locale";
import { UI_MESSAGES } from "./ui-messages";

// Only explicit UI boundaries call this function. Unknown text remains verbatim.
export function translateUi(locale: Locale, text: string): string {
  if (locale !== "en" || !text) return text;
  const key = text.replace(/\s+/g, " ").trim();
  const translated = message(key) ?? translateTemplate(key);
  if (translated !== undefined) return `${/^\s/.test(text) ? " " : ""}${translated}${/\s$/.test(text) ? " " : ""}`;
  return text;
}

const message = (key: string): string | undefined => Object.hasOwn(UI_MESSAGES, key) ? UI_MESSAGES[key] : undefined;

function translateTemplate(text: string): string | undefined {
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^项目登记 · (\d+) \/ (\d+)$/))) return `Project details · ${match[1]} / ${match[2]}`;
  if ((match = text.match(/^修改(.+)$/)) && message(match[1])) return `Edit ${message(match[1])}`;
  if ((match = text.match(/^请缩短到 (\d+) 个字符以内。$/))) return `Please use no more than ${match[1]} characters.`;
  if ((match = text.match(/^范围 (\d+) · 第 (\d+) 轮$/))) return `Scope ${match[1]} · Round ${match[2]}`;
  if ((match = text.match(/^找到 (\d+) 条$/))) return `${match[1]} results found`;
  if ((match = text.match(/^已提问 (\d+) 次$/))) return `${match[1]} ${match[1] === "1" ? "question" : "questions"} asked`;
  if ((match = text.match(/^已执行（(.+)）$/))) return `Executed (${message(match[1]) ?? match[1]})`;
  if ((match = text.match(/^匹配到 (\d+) 篇已发布资料：$/))) return `${match[1]} published resources matched:`;
  if ((match = text.match(/^已发布 · 第 (\d+) 版$/))) return `Published · Version ${match[1]}`;
  if ((match = text.match(/^当前发布第 (\d+) 版 · (可公开|仅内部)(，有修改待发布)?$/))) return `Published version ${match[1]} · ${message(match[2])}${match[3] ? ", unpublished changes" : ""}`;
  if ((match = text.match(/^闸门①已确认 · 第 (\d+) 版 · (.+)$/))) return `Gate 1 approved · Version ${match[1]} · ${match[2]}`;
  if ((match = text.match(/^(已接受|已报价) (¥[\d,.]+)$/))) return `${message(match[1]) ?? match[1]} ${match[2]}`;
  if ((match = text.match(/^报价 (¥[\d,.]+)$/))) return `Quote ${match[1]}`;
  if ((match = text.match(/^· (\d+) 个任务未计价$/))) return `· ${match[1]} unpriced tasks`;
  if ((match = text.match(/^，共 (\d+) 项$/))) return `, ${match[1]} items in total`;
  if ((match = text.match(/^你提交的预算和时间要求为「(.*)」。$/))) return `Your budget and timeline: “${match[1]}”.`;
  if ((match = text.match(/^第 (\d+) 版 · (.+)$/)) && message(match[2])) return `Version ${match[1]} · ${message(match[2])}`;
  if ((match = text.match(/^已验证 (\d+) 条 · 待验证 (\d+) 条$/))) return `${match[1]} verified · ${match[2]} awaiting verification`;
  if ((match = text.match(/^已复盘 · (.+)$/)) && message(match[1])) return `Reviewed · ${message(match[1])}`;
  if ((match = text.match(/^需求第 (\d+) 版 · 范围第 (\d+) 版$/))) return `Brief version ${match[1]} · Scope version ${match[2]}`;
  if ((match = text.match(/^产品截图 (\d+)$/))) return `Product screenshot ${match[1]}`;
  if ((match = text.match(/^最近交接 · (.+) → (.+)$/))) return `Latest handoff · ${message(match[1]) ?? match[1]} → ${message(match[2]) ?? match[2]}`;
  if ((match = text.match(/^(lumi|nori|fino|milo|kito|pogo|yuki|toby) · (.+)$/))) {
    const detail = message(match[2]) ?? translateTemplate(match[2]);
    if (detail) return `${match[1]} · ${detail}`;
  }
  if ((match = text.match(/^(.+) · (.+) 开始$/)) && message(match[1])) return `${message(match[1])} · Started ${match[2]}`;
  if ((match = text.match(/^等客户回答 (\d+) 个问题$/))) return `Awaiting customer answers to ${match[1]} questions`;
  if ((match = text.match(/^(\d+) 条客服问题等老板处理$/))) return `${match[1]} support questions need owner review`;
  if ((match = text.match(/^(\d+) 条客服待处理$/))) return `${match[1]} support questions pending`;
  // Lists here contain predefined labels, never project prose or customer answers.
  if (text.includes("、")) {
    const labels = text.split("、");
    if (labels.every((label) => !/[\u3400-\u9fff]/.test(label) || message(label))) return labels.map((label) => message(label) ?? label).join(", ");
  }
  return undefined;
}
