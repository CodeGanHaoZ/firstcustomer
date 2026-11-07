import type { Locale } from "./locale";

// Illustrative collaboration, not a projection of an individual project's status.
const stories = {
  zh: [
    ["整理产品目标与限制", "需求卡", "Nori 核对海外需求、竞品与反面证据", "提交资料并启动免费分析后，先交付出海机会报告。", "先和 Lumi 聊聊产品，再由你决定是否继续 Pro。"],
    ["查找需求、竞品和来源", "候选人群与证据卡", "Fino 比较人群，写出定位和验证计划", "Free 先交付报告；选择 Pro 并完成服务确认后，才进入策略。", "先看证据与未知项，再决定要验证哪一条方向。"],
    ["整理客户提交的付款记录", "付款凭证", "Milo 读取金额、时间与待核对项", "读取凭证后，仍需经营者核实实际到账，才会继续付费服务。", "按已确认的报价提交凭证，等待首客核对。"],
    ["比较人群、明确验证标准", "定位方案与实验计划", "Kito 制作英文验证页与渠道素材", "经营者把关、你确认定位后，Kito 才会开始准备页面。", "确认定位或提出修改；方向确定后再准备发布。"],
    ["制作英文页面、核对事实声明", "英文验证页与渠道行动卡", "Pogo 整理真实访问、留资和回复", "页面通过审批后才公开，渠道行动还需实际执行并记录。", "确认是否公开；发布后按渠道计划积累真实反馈。"],
    ["对照标准，复盘真实反馈", "增长复盘与下一步建议", "Fino 根据反馈调整下一轮验证", "先由经营者和你决定继续、调整或停止，再进入下一轮。", "查看结果与样本限制，确认下一轮或验收本次交付。"],
  ],
  en: [
    ["Clarify goals and constraints", "Project brief", "Nori checks demand, competitors and counterevidence", "After you submit a brief and start the free assessment, you receive an opportunity report first.", "Talk to Lumi about your product, then decide whether to continue with Pro."],
    ["Investigate needs, competitors and sources", "Audience and evidence cards", "Fino compares audiences and defines the first test", "Free delivers a report first. Strategy starts after you choose Pro and confirm the service.", "Review the evidence and unknowns before choosing a direction to test."],
    ["Organize the customer's payment record", "Payment proof", "Milo extracts details and items to verify", "The operator must still confirm actual receipt of funds before paid work continues.", "Submit proof against the accepted quote, then wait for HiFirst to verify it."],
    ["Compare audiences and define success criteria", "Positioning and validation plan", "Kito builds the English page and channel assets", "Kito starts after operator review and your positioning approval.", "Approve the direction or request changes before page preparation."],
    ["Build the English page and check factual claims", "English page and channel action card", "Pogo organizes real visits, leads and replies", "Publishing requires approval. Channel actions must then be carried out and recorded.", "Approve publication, then gather real feedback through the channel plan."],
    ["Review real feedback against preset criteria", "Growth review and next-step recommendations", "Fino adjusts the next validation round", "The operator and you decide whether to continue, adjust or stop before another round.", "Review results and sample limits, then approve another round or accept the delivery."],
  ],
} as const;
export const officeStory = (index: number, locale: Locale) => {
  const [task, output, next, condition, action] = stories[locale][index];
  return { task, output, next, condition, action };
};
export const OFFICE_PHASES = {
  zh: ["处理任务", "带着成果出发", "当面核对", "交付并接收", "带回工位", "接手开工"],
  en: ["Working", "Taking the handoff", "Checking together", "Passing the work", "Returning to the desk", "Starting the next task"],
} as const;
