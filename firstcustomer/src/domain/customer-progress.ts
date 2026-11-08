import type { Gate } from "./approval";
import { STATUS_LABELS, type ProjectStatus } from "./workflow";

const WORK_PHASES: Partial<Record<ProjectStatus, { agent: string; label: string; work: string }>> = {
  researching: { agent: "research", label: "研究员", work: "收集市场需求、竞品与反面证据" },
  drafting_quote: { agent: "quote", label: "接待报价员", work: "整理服务范围、交付物和提案" },
  reading_receipt: { agent: "receipt", label: "票据员", work: "读取付款截图，之后由首客核对实际到账" },
  strategizing: { agent: "strategy", label: "策略师", work: "比较候选人群并制定定位" },
  preparing_page: { agent: "launch", label: "发布员", work: "准备英文验证页和渠道素材" },
  reviewing: { agent: "growth", label: "增长员", work: "核对访问、留资与回复，整理复盘" },
};

const CONFIRMATION_TEXT: Record<Gate, string> = {
  positioning: "首客已把关定位方案，等你确认或提出修改。",
  publish: "首客已把关当前版本，请预览页面并确认是否公开。",
  next_round: "首客已把关下一轮实验，等你确认是否继续。",
};

type Progress = { title: string; detail: string; refreshSeconds?: number; action?: { href: string; label: string } };

export function customerProgress(input: {
  status: string;
  paused: boolean;
  runningAgents: string[];
  openGate: Gate | null;
  reportReady: boolean;
  quoteVisible: boolean;
  awaitingPayment: boolean;
  receiptUploaded: boolean;
  deliveryStatus?: string;
  canStartFree?: boolean;
  selfServicePro?: boolean;
  proInactive?: boolean;
}): Progress {
  if (input.proInactive) return { title: "Pro 账号权益当前不可用", detail: "请在账号工作台核对版本，现有项目资料会保留。", action: { href: "/account/upgrade", label: "查看账号版本" } };
  const phase = input.status === "reviewing" && input.reportReady ? undefined : WORK_PHASES[input.status as ProjectStatus];
  const actor = phase && input.runningAgents.includes(phase.agent) ? phase.label
    : phase && input.runningAgents.includes("vision") ? "截图读取员" : null;
  if (input.paused && input.status !== "delivered" && input.status !== "cancelled") {
    return {
      title: "项目已暂停",
      detail: actor ? `${actor}正在完成已开始的步骤。项目恢复后才会开始下一步。` : "首客恢复项目后将继续处理。",
      refreshSeconds: actor ? 3 : 12,
    };
  }
  if (phase) {
    const detail = actor === "截图读取员" ? "截图读取员正在整理你上传的图片。"
      : actor ? `${actor}正在${phase.work}。` : `正在等待${phase.label}开始处理。`;
    return { title: input.status === "researching" ? "正在分析你的出海机会" : STATUS_LABELS[input.status as ProjectStatus], detail, refreshSeconds: 3 };
  }
  if (input.openGate) {
    return { title: "待你确认", detail: input.selfServicePro ? "Pro 方案已准备好，请核对当前版本后确认或提出修改。" : CONFIRMATION_TEXT[input.openGate], action: { href: "#approval", label: "查看待确认事项" } };
  }

  switch (input.status) {
    case "submitted": return input.selfServicePro
      ? { title: "Pro 工作模块已开通", detail: "从 Pro 工作台选择模块即可启动项目，无需初步报价。", action: { href: "/account/pro", label: "进入 Pro 工作台" } }
      : input.canStartFree
      ? { title: "可以免费分析出海机会", detail: "提交的资料已保存。点击下方按钮即可排队开始。", refreshSeconds: 3 }
      : { title: "已提交", detail: "项目已提交，等待首客老板确认后开始研究。", refreshSeconds: 12 };
    case "free_ready": return { title: "你的出海机会报告已生成", detail: "你可以查看候选人群和待验证事项，或购买 Pro 继续做定位与发布。", action: { href: "#diagnosis", label: "查看出海机会报告" } };
    case "needs_info": return { title: "待你补充资料", detail: "研究员需要你补充信息，可以先保存已填的回答。", action: { href: "#clarifications", label: "回答追问" } };
    case "awaiting_quote": return { title: "首客正在核对报价", detail: "服务范围和价格确认后会在这里显示。", refreshSeconds: 12 };
    case "awaiting_quote_acceptance": return input.quoteVisible
      ? { title: "待你确认报价", detail: "请查看服务范围、价格和条款，接受或退回提案。", action: { href: "#proposal", label: "查看服务提案" } }
      : { title: "报价待更新", detail: "请稍后查看最新提案。", refreshSeconds: 12 };
    case "awaiting_payment": return input.receiptUploaded
      ? { title: "待首客确认到账", detail: "付款截图已收到，首客将核对实际收款。", refreshSeconds: 12 }
      : input.awaitingPayment
        ? { title: "待付款", detail: "你已接受报价，可以查看付款说明。", action: { href: "#payment", label: "查看付款说明" }, refreshSeconds: 12 }
        : { title: "付款信息待更新", detail: "请稍后查看付款说明。", refreshSeconds: 12 };
    case "awaiting_positioning": return { title: "首客正在核对定位", detail: "老板把关后会请你确认。", refreshSeconds: 12 };
    case "awaiting_publish": return { title: "首客正在核对发布版本", detail: "老板把关后会请你确认是否发布。", refreshSeconds: 12 };
    case "published":
    case "collecting": return { title: "验证页已公开", detail: "正在收集访问与反馈，样本够了再进行复盘。", action: { href: "#launch", label: "查看验证页" }, refreshSeconds: 12 };
    case "reviewing": return { title: "复盘已生成", detail: input.selfServicePro ? "可查看本轮复盘，核对结果与下一步建议。" : "首客正在核对复盘与交付清单。", action: { href: "#growth", label: "查看增长复盘" }, refreshSeconds: 12 };
    case "awaiting_founder": return { title: "等首客决定下一步", detail: "前序材料已保存，首客会先核对当前问题。", refreshSeconds: 12 };
    case "failed": return input.canStartFree
      ? { title: "出海机会分析暂未完成", detail: "项目资料已保留，可以重新分析出海机会。" }
      : { title: "处理遇到问题", detail: "首客可以核对原因并继续，已保存的交付记录可查阅。", action: { href: "#support", label: "询问进度" }, refreshSeconds: 12 };
    case "delivered": return input.deliveryStatus === "accepted"
      ? { title: "已验收", detail: "你已确认验收，可以随时查阅交付清单。", action: { href: "#deliverables", label: "查看交付清单" } }
      : input.deliveryStatus === "changes_requested"
        ? { title: "已收到修改意见", detail: "首客可以查看你提交的意见。你也可以补充意见或确认验收。", action: { href: "#delivery", label: "查看验收记录" } }
        : { title: "待你验收", detail: "首客已交付。你可以确认验收，或写明需要修改的地方。", action: { href: "#delivery", label: "前往验收" } };
    case "cancelled": return { title: "项目已取消", detail: "已有资料仍可查阅。如有问题，可以联系首客客服。", action: { href: "#support", label: "联系首客客服" } };
    default: return { title: "进度待更新", detail: "请稍后查看项目进度。" };
  }
}
