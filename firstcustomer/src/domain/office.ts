import { OFFICE_CHARACTERS } from "@/lib/brand";
import type { GateState } from "./approval";
import { founderReady } from "./approval";
import type { ProjectStatus } from "./workflow";

export type DepartmentKey = "frontdesk" | "research" | "strategy" | "finance" | "launch" | "growth";

export type OfficeTransfer = { id: string; from: DepartmentKey; to: DepartmentKey; at: string };

export const OFFICE_TRANSFER_STEPS: {
  phaseFrom: ProjectStatus; phaseTo: ProjectStatus; from: DepartmentKey; to: DepartmentKey;
}[] = [
  { phaseFrom: "researching", phaseTo: "drafting_quote", from: "research", to: "frontdesk" },
  { phaseFrom: "researching", phaseTo: "strategizing", from: "research", to: "strategy" },
  { phaseFrom: "awaiting_quote_acceptance", phaseTo: "awaiting_payment", from: "frontdesk", to: "finance" },
  { phaseFrom: "awaiting_payment", phaseTo: "strategizing", from: "finance", to: "strategy" },
  { phaseFrom: "awaiting_positioning", phaseTo: "preparing_page", from: "strategy", to: "launch" },
  { phaseFrom: "published", phaseTo: "collecting", from: "launch", to: "growth" },
  { phaseFrom: "reviewing", phaseTo: "strategizing", from: "growth", to: "strategy" },
  { phaseFrom: "strategizing", phaseTo: "researching", from: "strategy", to: "research" },
  { phaseFrom: "preparing_page", phaseTo: "strategizing", from: "launch", to: "strategy" },
];

export type AgentState =
  | "idle"
  | "scheduled"
  | "running"
  | "waiting"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "paused";

export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  idle: "空闲",
  scheduled: "计划中",
  running: "工作中",
  waiting: "等待数据",
  awaiting_approval: "等待审批",
  completed: "已完成",
  failed: "失败",
  paused: "已暂停",
};

export const AGENT_LABELS: Record<string, string> = {
  quote: `${OFFICE_CHARACTERS.frontdesk.name} · 接待报价员`,
  receipt: `${OFFICE_CHARACTERS.finance.name} · 票据员`,
  support: `${OFFICE_CHARACTERS.frontdesk.name} · 客服`,
  vision: `${OFFICE_CHARACTERS.research.name} · 截图读取`,
  research: `${OFFICE_CHARACTERS.research.name} · Research`,
  strategy: `${OFFICE_CHARACTERS.strategy.name} · Strategy`,
  launch: `${OFFICE_CHARACTERS.launch.name} · Launch`,
  growth: `${OFFICE_CHARACTERS.growth.name} · Growth`,
  weekly: `${OFFICE_CHARACTERS.coo.name} · 经营周报`,
  standup: `${OFFICE_CHARACTERS.coo.name} · COO 站会`,
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  succeeded: "完成",
  failed: "失败",
  sent_back: "已打回",
  rejected: "声明检查未通过",
  escalated: "打回超限",
};

export const TASK_TRIGGER_LABELS: Record<string, string> = {
  normal: "正常",
  send_back: "打回后执行",
  rewrite: "改写",
};

export const DEPARTMENTS: { key: DepartmentKey; room: string; agent: string; duty: string }[] = [
  { key: "frontdesk", room: "前台", agent: AGENT_LABELS.quote, duty: "整理出海机会报告，起草提案和报价，接待客户问题" },
  { key: "research", room: "市场研究室", agent: AGENT_LABELS.research, duty: "研究海外需求、竞品定价和反面证据，每条结论都带来源" },
  { key: "strategy", room: "战略决策室", agent: AGENT_LABELS.strategy, duty: "比较两个目标人群，写出定位和实验计划，证据不够就打回研究室" },
  { key: "finance", room: "财务室", agent: AGENT_LABELS.receipt, duty: "读取付款截图，等老板核对到账，汇总真实收款和费用" },
  { key: "launch", room: "产品发布室", agent: AGENT_LABELS.launch, duty: "写英文验证页和渠道素材，没有证据的声明不能送审" },
  { key: "growth", room: "增长运营室", agent: AGENT_LABELS.growth, duty: "读取真实访问和留资，按预设标准判断实验结果" },
];

export type OfficeTask = {
  id: string;
  agent: string;
  status: string;
  startedAt: Date;
  round: number;
  sendBackRoute: string | null;
  sendBackReason: string | null;
};

export type OfficeInput = {
  status: ProjectStatus;
  round: number;
  paused: boolean;
  failedFrom: string | null;
  escalationFrom: string | null;
  // 新的在前。
  tasks: OfficeTask[];
  gates: { positioning: GateState; publish: GateState; next_round: GateState };
  hasReport: boolean;
  nextRoundAvailable?: boolean;
  pagePublished: boolean;
  unansweredQuestions: number;
  supportPending?: number;
  supportEscalated?: number;
};

export type DepartmentView = {
  key: DepartmentKey;
  state: AgentState;
  detail: string;
  runningSince: Date | null;
  handoff: { id: string; to: DepartmentKey; reason: string; at: Date } | null;
};

const AGENT_ROOM: Record<string, DepartmentKey> = {
  quote: "frontdesk",
  support: "frontdesk",
  receipt: "finance",
  vision: "research",
  research: "research",
  strategy: "strategy",
  launch: "launch",
  growth: "growth",
};

export function officeRoomForAgent(agent: string): DepartmentKey | undefined {
  return Object.hasOwn(AGENT_ROOM, agent) ? AGENT_ROOM[agent] : undefined;
}

const STATUS_ROOM: Partial<Record<ProjectStatus, DepartmentKey>> = {
  drafting_quote: "frontdesk",
  awaiting_quote: "frontdesk",
  awaiting_quote_acceptance: "frontdesk",
  awaiting_payment: "finance",
  reading_receipt: "finance",
  researching: "research",
  needs_info: "research",
  strategizing: "strategy",
  awaiting_positioning: "strategy",
  preparing_page: "launch",
  awaiting_publish: "launch",
  collecting: "growth",
  reviewing: "growth",
};

const ROUTE_TARGET: Record<string, DepartmentKey> = {
  "strategy->research": "research",
  "launch->strategy": "strategy",
  "growth->strategy": "strategy",
};

function gateDetail(gate: GateState, subject: string) {
  return founderReady(gate) ? `${subject}，等客户确认` : `${subject}，等首客老板把关`;
}

// 人物状态完全由后台业务状态推出，前端不另外维护一套。
export function departmentViews(input: OfficeInput): DepartmentView[] {
  const { status } = input;
  const current = STATUS_ROOM[status];
  const succeeded = (key: DepartmentKey) =>
    input.tasks.some((t) => AGENT_ROOM[t.agent] === key && t.status === "succeeded");

  return DEPARTMENTS.map(({ key }) => {
    const running = input.tasks.find((t) => AGENT_ROOM[t.agent] === key && t.status === "running");
    const handoffTask = input.tasks.find((t) => t.round === input.round && AGENT_ROOM[t.agent] === key && t.status === "sent_back");
    const target = handoffTask?.sendBackRoute ? ROUTE_TARGET[handoffTask.sendBackRoute] : undefined;
    const handoff = handoffTask && target
      ? { id: handoffTask.id, to: target, reason: handoffTask.sendBackReason ?? "", at: handoffTask.startedAt }
      : null;
    const view = (state: AgentState, detail: string): DepartmentView => ({
      key,
      state,
      detail,
      runningSince: state === "running" ? (running?.startedAt ?? null) : null,
      handoff,
    });

    if (status === "failed" && STATUS_ROOM[input.failedFrom as ProjectStatus] === key) {
      return view("failed", "执行失败，可以查看原因后重试");
    }
    if (status === "awaiting_founder" && STATUS_ROOM[input.escalationFrom as ProjectStatus] === key) {
      return view("awaiting_approval", "打回次数到上限，等首客老板裁决");
    }

    if (current === key) {
      const working = status === "researching" || status === "drafting_quote" || status === "reading_receipt" ||
        status === "strategizing" || status === "preparing_page" ||
        (status === "reviewing" && !input.hasReport);
      if (working) {
        if (input.paused && !running) return view("paused", "已暂停，恢复后继续");
        if (!running) return view("scheduled", "任务已安排，等待后台开始");
        return view("running", input.paused ? "完成当前步骤后暂停" : "正在执行任务");
      }
      if (input.paused) return view("paused", "已暂停，恢复后继续");
      if (status === "needs_info") {
        return view("awaiting_approval", `等客户回答 ${input.unansweredQuestions} 个问题`);
      }
      if (status === "awaiting_quote") return view("awaiting_approval", "提案已起草，等老板确认价格和条款");
      if (status === "awaiting_quote_acceptance") return view("awaiting_approval", "等客户接受报价");
      if (status === "awaiting_payment") return view("waiting", "等付款截图或老板确认到账");
      if (status === "awaiting_positioning") return view("awaiting_approval", gateDetail(input.gates.positioning, "定位方案已提交"));
      if (status === "awaiting_publish") return view("awaiting_approval", gateDetail(input.gates.publish, "页面通过声明检查"));
      if (status === "collecting") return view("waiting", "页面已发布，等待真实访问和留资");
      if (status === "reviewing") return input.gates.next_round.founderRequired === false && input.nextRoundAvailable === false
        ? view("completed", "本轮复盘已完成") : view("awaiting_approval", gateDetail(input.gates.next_round, "复盘完成"));
    }

    if (key === "frontdesk") {
      if (running) return view("running", "正在根据项目记录回复客户");
      if (input.supportEscalated) return view("awaiting_approval", `${input.supportEscalated} 条客服问题等老板处理`);
      if (input.supportPending) return view(input.paused ? "paused" : "waiting", "客服问题已收到，等待处理");
    }

    if (key === "research" && status === "submitted") return view("idle", "等首客老板确认后开始研究");
    if (key === "launch" && input.pagePublished) return view("completed", "英文验证页已公开");
    if (key === "growth" && status === "delivered") return view("completed", "复盘已交付");
    if (succeeded(key)) return view("completed", "交付物已保存");
    return view("idle", "还没有任务");
  });
}
