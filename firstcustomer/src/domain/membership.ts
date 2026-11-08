export type CustomerPlan = "free" | "pro";
export type MembershipSource = "test" | "key" | "payment" | "manual";
export type MembershipRecord = { plan: CustomerPlan; source: MembershipSource; status: "active" | "revoked"; expiresAt: Date | null };

export const MEMBERSHIP_SERVICE_POLICY = "当前版本：Free 提供基础出海机会分析；报告生成后，客户在项目页确认计价模型生成的服务范围和报价，完成付款校验后自动开通本项目 Pro 并启动执行，无需申请、老板批价或逐单开通。项目 Pro 包含当前范围的定位、英文验证页、渠道行动方案和一轮增长复盘；付费推广和额外人工服务需另行确认。定位与公开发布由客户确认，证据检查保留。项目购买不自动授予账号级或其他项目 Pro。已有有效 Pro 账号和项目密钥继续按原权益执行。历史人工报价与核款只适用于旧订单。具体金额、付款校验和项目开通状态以程序提供的当前记录为准，不从资料推断已付款，也不把权益开通记录当作真实收入。";

export function effectiveCustomerPlan(membership: MembershipRecord | null | undefined, now = new Date()): CustomerPlan {
  return membership?.plan === "pro" && membership.status === "active" &&
    (!membership.expiresAt || membership.expiresAt > now) ? "pro" : "free";
}

export const PRO_MODULES = [
  { key: "research", anchor: "diagnosis", zh: "市场研究", en: "Market research" },
  { key: "strategy", anchor: "strategy", zh: "定位与验证方案", en: "Positioning & validation" },
  { key: "launch", anchor: "launch", zh: "英文页面与渠道", en: "English page & channels" },
  { key: "growth", anchor: "growth", zh: "增长复盘", en: "Growth review" },
] as const;
