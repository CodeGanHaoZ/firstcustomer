import type { GateState } from "./approval";
import type { ProjectStatus } from "./workflow";

export type DepartmentKey = "research" | "strategy" | "launch" | "growth";

export type AgentState =
  | "idle"
  | "running"
  | "waiting"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "paused";

export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  idle: "空闲",
  running: "工作中",
  waiting: "等待数据",
  awaiting_approval: "等待审批",
  completed: "已完成",
  failed: "失败",
  paused: "已暂停",
};

export const DEPARTMENTS: { key: DepartmentKey; room: string; agent: string; duty: string }[] = [
  { key: "research", room: "市场研究室", agent: "研究员 Research", duty: "研究海外需求、竞品定价和反面证据，每条结论都带来源" },
  { key: "strategy", room: "战略决策室", agent: "策略师 Strategy", duty: "比较两个目标人群，写出定位和实验计划，证据不够就打回研究室" },
  { key: "launch", room: "产品发布室", agent: "发布员 Launch", duty: "写英文验证页和渠道素材，没有证据的声明不能送审" },
  { key: "growth", room: "增长运营室", agent: "增长员 Growth", duty: "读取真实访问和留资，按预设标准判断实验结果" },
];

export type OfficeTask = {
  agent: string;
  status: string;
  startedAt: Date;
  sendBackRoute: string | null;
  sendBackReason: string | null;
};

export type OfficeInput = {
  status: ProjectStatus;
  paused: boolean;
  failedFrom: string | null;
  escalationFrom: string | null;
  // 新的在前。
  tasks: OfficeTask[];
  gates: { positioning: GateState; publish: GateState; next_round: GateState };
  hasReport: boolean;
  pagePublished: boolean;
  unansweredQuestions: number;
};

export type DepartmentView = {
  key: DepartmentKey;
  state: AgentState;
  detail: string;
  runningSince: Date | null;
  handoff: { to: DepartmentKey; reason: string } | null;
};

const AGENT_ROOM: Record<string, DepartmentKey> = {
  vision: "research",
  research: "research",
  strategy: "strategy",
  launch: "launch",
  growth: "growth",
};

const STATUS_ROOM: Partial<Record<ProjectStatus, DepartmentKey>> = {
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
  return gate.founder === "pending" ? `${subject}，等首客老板把关` : `${subject}，等客户确认`;
}

// 人物状态完全由后台业务状态推出，前端不另外维护一套。
export function departmentViews(input: OfficeInput): DepartmentView[] {
  const { status } = input;
  const current = STATUS_ROOM[status];
  const latest = (key: DepartmentKey) => input.tasks.find((t) => AGENT_ROOM[t.agent] === key);
  const succeeded = (key: DepartmentKey) =>
    input.tasks.some((t) => AGENT_ROOM[t.agent] === key && t.status === "succeeded");

  return DEPARTMENTS.map(({ key }) => {
    const task = latest(key);
    const running = input.tasks.find((t) => AGENT_ROOM[t.agent] === key && t.status === "running");
    const handoffTarget = task?.status === "sent_back" && task.sendBackRoute ? ROUTE_TARGET[task.sendBackRoute] : undefined;
    const handoff = handoffTarget ? { to: handoffTarget, reason: task?.sendBackReason ?? "" } : null;
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
      const working = status === "researching" || status === "strategizing" || status === "preparing_page" ||
        (status === "reviewing" && !input.hasReport);
      if (working) {
        if (input.paused && !running) return view("paused", "已暂停，恢复后继续");
        return view("running", input.paused ? "完成当前步骤后暂停" : "正在执行任务");
      }
      if (input.paused) return view("paused", "已暂停，恢复后继续");
      if (status === "needs_info") {
        return view("awaiting_approval", `等客户回答 ${input.unansweredQuestions} 个问题`);
      }
      if (status === "awaiting_positioning") return view("awaiting_approval", gateDetail(input.gates.positioning, "定位方案已提交"));
      if (status === "awaiting_publish") return view("awaiting_approval", gateDetail(input.gates.publish, "页面通过声明检查"));
      if (status === "collecting") return view("waiting", "页面已发布，等待真实访问和留资");
      if (status === "reviewing") return view("awaiting_approval", "复盘完成，等首客老板决定交付或下一轮");
    }

    if (key === "research" && status === "submitted") return view("idle", "等首客老板确认后开始研究");
    if (key === "launch" && input.pagePublished) return view("completed", "英文验证页已公开");
    if (key === "growth" && status === "delivered") return view("completed", "复盘已交付");
    if (succeeded(key)) return view("completed", "交付物已保存");
    return view("idle", "还没有任务");
  });
}
