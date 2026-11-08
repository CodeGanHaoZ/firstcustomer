export const OWNER_PERMISSIONS = {
  "workspace.read": { label: "查看公司经营", description: "查看全公司项目、任务、订单、运行状态与经营报表。" },
  "projects.manage": { label: "管理项目", description: "建项、补充资料、暂停、恢复、重试与处理异常。" },
  "payments.confirm": { label: "核对实际收款", description: "核对付款凭证与到账金额，记录差额原因；截图不能自动入账。" },
  "delivery.approve": { label: "审核定位、发布与交付", description: "审阅当前成果并送客户确认；不能替外部客户验收。" },
  "support.reply": { label: "处理客服升级", description: "处理投诉等升级问题，记录老板回复与决定。" },
  "growth.manage": { label: "管理增长记录", description: "记录渠道执行、反馈，维护测试线索与客户数据。" },
  "company.manage": { label: "管理公司设置", description: "确认宪章、经营周报、收款设置与人工投入。" },
  "knowledge.manage": { label: "管理内部资料", description: "导入、修订、发布和撤下内部知识资料。" },
  "audit.read": { label: "核查决策记录", description: "按项目和角色查看决定、版本、理由与历史快照。" },
  "accounts.manage": { label: "管理身份与权限", description: "核查老板账号及权限边界；内部账号不允许公开注册。" },
} as const;

export type OwnerPermission = keyof typeof OWNER_PERMISSIONS;
export const OWNER_PERMISSION_KEYS = Object.keys(OWNER_PERMISSIONS) as OwnerPermission[];

// A customer-selected role or a project invitation can never grant an internal capability.
export function hasOwnerPermission(role: unknown, permission: string) {
  return role === "owner" && Object.hasOwn(OWNER_PERMISSIONS, permission);
}
