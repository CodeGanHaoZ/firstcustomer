import type { DepartmentKey } from "@/domain/office";

export const OFFICE_MEMBERS = [
  { key: "frontdesk", name: "lumi 露米", animal: "奶油兔", role: "接待与报价 Agent", room: "前台", portrait: [0, 0], scene: 0,
    description: "把模糊的想法聊清楚，也把每一次交接安排妥当。从需求登记到提案报价，lumi 是你在首客的第一位伙伴。",
    output: "需求卡、服务提案、客服答复", collaboration: "整理目标与限制，交给研究员继续核实。" },
  { key: "research", name: "猫头鹰", animal: "灰绿猫头鹰", role: "Research · 市场研究", room: "市场研究室", portrait: [1, 0], scene: 1,
    description: "带着问题找依据。研究海外需求、竞品定价和反面证据，把来源与不确定项一起交给团队。",
    output: "候选人群、市场证据卡", collaboration: "将证据交给策略师；缺少依据时继续补查。" },
  { key: "strategy", name: "狐狸", animal: "赤狐", role: "Strategy · 定位策略", room: "战略决策室", portrait: [2, 0], scene: 3,
    description: "在多个方向中找出值得先试的一条。比较目标人群，写清定位、实验假设和判断标准，等待你确认。",
    output: "定位方案、验证计划", collaboration: "把确认后的方向交给发布员，证据不足就退回研究。" },
  { key: "finance", name: "松栗", animal: "松鼠", role: "Receipt · 付款凭证", room: "财务室", portrait: [1, 1], scene: 2,
    description: "认真对待每一笔记录。读取客户提交的付款凭证，整理待核对信息，实际到账由老板确认。",
    output: "凭证识别、收款待核对项", collaboration: "和前台核对订单，确认到账后再继续付费服务。" },
  { key: "launch", name: "浣熊", animal: "蓝灰浣熊", role: "Launch · 产品发布", room: "产品发布室", portrait: [3, 0], scene: 4,
    description: "把策略变成能展示的作品。准备英文验证页与渠道素材，核对事实声明，经过审批再推进发布。",
    output: "英文验证页、渠道行动卡", collaboration: "承接定位方案，将发布记录交给增长员。" },
  { key: "growth", name: "青蛙", animal: "青蛙", role: "Growth · 增长复盘", room: "增长运营室", portrait: [0, 1], scene: 5,
    description: "用真实反馈回答下一步。整理访问、留资与回复，按预设标准复盘；样本不足时，也会如实告诉你。",
    output: "指标复盘、下一步建议", collaboration: "把实验结果带回策略室，决定继续、调整或停止。" },
] as const satisfies readonly { key: DepartmentKey; name: string; animal: string; role: string; room: string;
  portrait: readonly [number, number]; scene: number; description: string; output: string; collaboration: string }[];

export type DemoScene = { chapter: string; title: string; from: DepartmentKey; to: DepartmentKey;
  document: string; lines: readonly [string, string] };

export const OFFICE_SCENES: readonly DemoScene[] = [
  { chapter: "接待想法", title: "先把你的想法，交给对的伙伴。", from: "frontdesk", to: "research", document: "需求卡",
    lines: ["目标和限制整理好了，先看看哪些用户需要它？", "收到，我去查需求、竞品和反面证据。"] },
  { chapter: "研究市场", title: "先找依据，再选择方向。", from: "research", to: "strategy", document: "证据卡",
    lines: ["候选人群和来源都在这里，未知项也标出来了。", "我来比较两个人群，写清先验证什么。"] },
  { chapter: "核对凭证", title: "每一次推进，都有记录可核对。", from: "frontdesk", to: "finance", document: "付款凭证",
    lines: ["这里是客户提交的付款凭证，请帮忙读取。", "我先整理凭证信息，实际到账还要老板确认。"] },
  { chapter: "确定定位", title: "把确认的方向，变成能展示的作品。", from: "strategy", to: "launch", document: "定位方案",
    lines: ["方向与实验计划确认后，就按这个版本准备。", "明白，英文页面的每条事实声明都要核对。"] },
  { chapter: "准备发布", title: "发布前先确认，发布后看反馈。", from: "launch", to: "growth", document: "渠道行动卡",
    lines: ["页面与渠道素材备好了，审批后再对外发布。", "收到，我会记录真实的访问、留资和回复。"] },
  { chapter: "复盘反馈", title: "复盘的意义，是知道下一步怎么走。", from: "growth", to: "strategy", document: "复盘报告",
    lines: ["这一轮样本还不够，实际数据都整理在这里了。", "按原定标准复盘，再决定继续还是调整。"] },
];

export const DEMO_DURATION = 12_000;

export const demoMember = (key: DepartmentKey) => OFFICE_MEMBERS.find((member) => member.key === key)!;
