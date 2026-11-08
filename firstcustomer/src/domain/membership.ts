export type CustomerPlan = "free" | "pro";
export type MembershipSource = "test" | "key" | "payment" | "manual";
export type MembershipRecord = { plan: CustomerPlan; source: MembershipSource; status: "active" | "revoked"; expiresAt: Date | null };

export const MEMBERSHIP_SERVICE_POLICY = "当前版本：Free 提供基础出海机会分析；报告生成后，客户在项目页确认计价模型生成的服务范围和报价，完成付款校验后自动开通本项目 Pro 并启动执行，无需申请、老板批价或逐单开通。新用户无需登录即可领取一次一轮完整验证试用，无需付款，当前浏览器限一个项目；登录后试用归入账号，每个账号限领一次；试用后购买的三轮为额外三轮，试用不抵扣付费轮数、不会自动扣费，也不授予账号级 Pro。新购标准项目 Pro 包含同一产品、同一目标市场的三轮完整验证，每轮都有定位、英文验证页、单渠道方案和增长复盘；同轮改稿及失败重试不扣轮数，开启下一轮须由客户确认，历史订单按已购买快照核对可用轮数；付费推广和额外人工服务需另行确认。定位与公开发布由客户确认，证据检查保留。项目购买不自动授予账号级或其他项目 Pro。已有有效 Pro 账号和项目密钥继续按原权益执行。老板不再逐单报价；未付款的旧提案改用项目自助购买，已有付款凭证的历史订单保留核对记录。具体金额、付款校验和项目开通状态以程序提供的当前记录为准，不从资料推断已付款，也不把权益开通记录当作真实收入。";

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
