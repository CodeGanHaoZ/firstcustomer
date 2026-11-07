export const QUOTE_STATUS_LABELS: Record<string, string> = {
  verified: "摘录已匹配", needs_review: "摘录待核对", rejected: "摘录未匹配",
};
export const SUPPORT_LABELS: Record<string, string> = {
  not_assessed: "未评价", needs_review: "待重新评价", supported: "较充分", limited: "有限", insufficient: "不足",
};
export const CONCLUSION_LABELS: Record<string, string> = {
  research: "机会分析", positioning: "定位判断", claim: "页面声明", growth: "增长复盘",
};
export const SUPPORT_RULE_VERSION = "hifirst-support-v1";
export const SUPPORT_RULE_DESCRIPTION = "较充分：已核对来源，适用条件明确且主要反证得到回应；有限：仍有间接性、样本或冲突限制；不足：现有材料不能支持当前表述。这是人工判断，不是成功概率或 GRADE 认证。";
