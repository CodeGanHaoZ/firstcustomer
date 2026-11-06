export type Gate = "positioning" | "publish" | "next_round";
export type ActorRole = "founder" | "customer";
export type Verdict = "approve" | "reject";

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
};

// 只看当前版本最后一次退回之后的批准：任何退回都让这一轮确认重新开始。
export function gateState(
  decisions: DecisionRecord[],
  gate: Gate,
  version: number,
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
    complete: approved("founder") && approved("customer"),
  };
}

export function decisionError(state: GateState, actor: ActorRole) {
  if (actor === "founder" && state.founder === "approved") {
    return "老板已经把关过这个版本";
  }
  if (actor === "customer" && state.founder !== "approved") {
    return "要等老板把关后，客户才能确认";
  }
  if (actor === "customer" && state.customer === "approved") {
    return "客户已经确认过这个版本";
  }
  return null;
}
