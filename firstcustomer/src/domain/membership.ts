export type CustomerPlan = "free" | "pro";
export type MembershipSource = "test" | "key" | "payment" | "manual";
export type MembershipRecord = { plan: CustomerPlan; source: MembershipSource; status: "active" | "revoked"; expiresAt: Date | null };

export const MEMBERSHIP_SERVICE_POLICY = "当前版本：Free 提供基础出海机会分析；有效 Pro 账号登录后直接使用高级工作模块，无需初步报价、付款截图和老板开通审核。定位与公开发布仍由客户确认，证据检查保留。Pro 定价尚未公布，暂不支持在线购买。历史资料中的报价与人工核款仅适用于旧订单，不能要求账号 Pro 重复支付；账号测试权益、项目密钥均不代表实际到账。具体账号权益与项目状态以程序提供的当前记录为准。";

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
