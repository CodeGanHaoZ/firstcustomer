export type Gate = "positioning" | "publish" | "next_round";
export type ActorRole = "founder" | "customer";
export type Verdict = "approve" | "reject";

export const DECISION_LABELS: Record<string, string> = {
  charter: "① 公司宪章",
  claim_check: "② 声明检查",
  positioning: "③ 定位确认",
  publish: "④ 发布确认",
  quote: "⑤ 报价确认",
  payment: "⑥ 到账确认",
  pro_access: "Pro 权益开通",
  support: "⑦ 客服升级处理",
  weekly: "⑧ 周报决策",
  acceptance: "⑨ 交付验收",
  next_round: "⑨ 下一轮实验",
  escalation: "老板裁决",
};

export type DecisionRecord = {
  gate: string;
  subjectVersion: number;
  actorRole: string;
  verdict: string;
  createdAt: Date;
};

export type GateState = {
  founder: "pending" | "approved";
  customer: "pending" | "approved";
  complete: boolean;
  founderRequired?: boolean;
};

// 只看当前版本最后一次退回之后的批准：任何退回都让这一轮确认重新开始。
export function gateState(
  decisions: DecisionRecord[],
  gate: Gate,
  version: number,
  founderRequired = true,
): GateState {
  const relevant = decisions
    .filter((d) => d.gate === gate && d.subjectVersion === version)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastReject = relevant.findLastIndex((d) => d.verdict === "reject");
  const active = relevant.slice(lastReject + 1);
  const approved = (role: ActorRole) =>
    active.some((d) => d.actorRole === role && d.verdict === "approve");
  return {
    founder: approved("founder") ? "approved" : "pending",
    customer: approved("customer") ? "approved" : "pending",
    complete: (!founderRequired || approved("founder")) && approved("customer"),
    ...(!founderRequired ? { founderRequired: false } : {}),
  };
}

export const founderReady = (state: GateState) => state.founderRequired === false || state.founder === "approved";

export function decisionError(state: GateState, actor: ActorRole) {
  if (actor === "founder" && state.founderRequired === false) return "Pro 项目由客户直接确认，无需老板审核";
  if (actor === "founder" && state.founder === "approved") {
    return "老板已经把关过这个版本";
  }
  if (actor === "customer" && !founderReady(state)) {
    return "要等老板把关后，客户才能确认";
  }
  if (actor === "customer" && state.customer === "approved") {
    return "客户已经确认过这个版本";
  }
  return null;
}
