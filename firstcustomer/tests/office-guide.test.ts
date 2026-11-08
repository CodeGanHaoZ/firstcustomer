import { describe, expect, it } from "vitest";
import { officeGuidance, customerOfficeStations, type OfficeGuideInput } from "@/domain/office-guide";
import { STATUS_LABELS } from "@/domain/workflow";
import { OFFICE_SCENES, OFFICE_TIMING as T, DEMO_DURATION } from "@/lib/office-showcase";
import { scenePoses } from "@/components/office-showcase-canvas";
import { desks } from "@/components/office-map";

const base: OfficeGuideInput = { status: "researching", paused: false, runningAgents: [], plan: "free" };
describe("office workflow guidance", () => {
  it("only says working when a real task is running, including screenshot reading", () => {
    expect(officeGuidance(base).state).toBe("queued");
    for (const agent of ["research", "vision"]) expect(officeGuidance({ ...base, runningAgents: [agent] }).state).toBe("working");
    expect(officeGuidance({ ...base, runningAgents: ["launch"] }).state).toBe("queued");
  });
  it("explains the real Free, Pro proposal, and already-paid research branches", () => {
    expect(officeGuidance(base).nextActor).toBe("customer");
    expect(officeGuidance({ ...base, plan: "pro", quoteRequired: true }).nextActor).toBe("customer");
    expect(officeGuidance({ ...base, plan: "pro", quoteRequired: true, quotePaid: true }).nextActor).toBe("strategy");
    expect(officeGuidance({ ...base, status: "free_ready" }).condition).toContain("本项目付款校验");
  });
  it("distinguishes operator review from customer approval and keeps the gates", () => {
    const waiting = { ...base, status: "awaiting_positioning" };
    expect(officeGuidance(waiting).state).toBe("waiting");
    expect(officeGuidance(waiting).link).toBeUndefined();
    expect(officeGuidance({ ...waiting, openGate: "positioning" })).toMatchObject({ state: "action", link: { href: "#approval" }, nextActor: "launch" });
    expect(officeGuidance({ ...waiting, audience: "operator", operatorTurn: true })).toMatchObject({ state: "action", link: { href: "#decisions" } });
    expect(officeGuidance({ ...waiting, audience: "operator", operatorTurn: false }).state).toBe("waiting");
    expect(officeGuidance({ ...base, status: "awaiting_quote" })).toMatchObject({ state: "action", nextActor: "finance" });
    expect(officeGuidance({ ...base, status: "awaiting_quote", audience: "operator" }).state).toBe("waiting");
  });
  it("does not confuse receipt upload with confirmation of actual funds", () => {
    expect(officeGuidance({ ...base, status: "awaiting_payment" }).state).toBe("action");
    const uploaded = officeGuidance({ ...base, status: "awaiting_payment", receiptUploaded: true });
    expect(uploaded.state).toBe("waiting");
    expect(uploaded.condition).toContain("实际到账");
    expect(officeGuidance({ ...base, status: "awaiting_payment", receiptUploaded: true, audience: "operator" }).state).toBe("action");
  });
  it("keeps account Pro guidance with the customer instead of inventing owner approval", () => {
    const pro = { ...base, plan: "pro" as const, selfServicePro: true };
    expect(officeGuidance({ ...pro, status: "submitted" }).yourAction).toContain("Pro 工作台");
    expect(officeGuidance({ ...pro, status: "strategizing" }).nextActor).toBe("customer");
    expect(officeGuidance({ ...pro, status: "preparing_page" }).nextActor).toBe("customer");
    expect(officeGuidance({ ...pro, status: "awaiting_positioning", openGate: "positioning" }).condition).toContain("你确认");
    expect(officeGuidance({ ...pro, status: "reviewing", reportReady: true })).toMatchObject({ state: "complete", link: { href: "#growth" } });
    expect(officeGuidance({ ...pro, status: "awaiting_positioning", proInactive: true })).toMatchObject({ state: "waiting", link: { href: "/account/upgrade" }, nextActor: "customer" });
  });
  it("distinguishes a running growth review from a report awaiting a decision", () => {
    expect(officeGuidance({ ...base, status: "reviewing", runningAgents: ["growth"] }).state).toBe("working");
    expect(officeGuidance({ ...base, status: "reviewing", reportReady: true, openGate: "next_round" })).toMatchObject({ state: "action", nextActor: "strategy" });
    expect(customerOfficeStations({ ...base, status: "collecting" }).find(s => s.key === "growth")?.state).toBe("waiting");
  });
  it("keeps finishing work visible during pause without promising another task", () => {
    const finishing = officeGuidance({ ...base, paused: true, runningAgents: ["research"] });
    expect(finishing).toMatchObject({ state: "working", room: "research", nextActor: null });
    expect(finishing.next).toContain("恢复项目后");
    expect(officeGuidance({ ...base, paused: true }).state).toBe("paused");
    expect(officeGuidance({ ...base, status: "failed", failedFrom: "preparing_page" })).toMatchObject({ state: "failed", room: "launch" });
    expect(customerOfficeStations({ ...base, status: "cancelled", runningAgents: ["research"] }).every(s => s.state !== "running")).toBe(true);
  });
  it("maps queued, waiting, active and complete desks without fabricating work", () => {
    const state = (input: OfficeGuideInput) => customerOfficeStations(input).find(s => s.key === "research")?.state;
    expect(state(base)).toBe("scheduled");
    expect(state({ ...base, runningAgents: ["research"] })).toBe("running");
    expect(state({ ...base, status: "needs_info" })).toBe("awaiting_approval");
    expect(state({ ...base, status: "free_ready" })).toBe("completed");
  });
  it("provides fully English guidance for every workflow state and safe unknown states", () => {
    for (const status of [...Object.keys(STATUS_LABELS), "__proto__", "constructor", "unknown"]) {
      for (const audience of ["customer", "operator"] as const) {
        for (const paused of [false, true]) {
          const input = { ...base, status, audience, paused, runningAgents: ["research"], openGate: "positioning" as const };
          const snapshot = structuredClone(input);
          const result = officeGuidance(input, "en");
          expect(JSON.stringify(result)).not.toMatch(/[\u3400-\u9fff]/);
          expect(result.task.length).toBeGreaterThan(0);
          expect(input).toEqual(snapshot);
        }
      }
    }
  });
});

describe("illustrative office handoff", () => {
  it.each(OFFICE_SCENES)("finishes $chapter with the receiver back at its desk and working", scene => {
    expect(scenePoses(scene, 0)).toMatchObject({ phase: 0, sender: { point: desks[scene.from].home, walking: false } });
    expect(scenePoses(scene, T.depart + 500).sender.walking).toBe(true);
    expect(scenePoses(scene, T.meet + 100)).toMatchObject({ phase: 2, exchanging: true, sender: { walking: false }, receiver: { walking: false } });
    expect(scenePoses(scene, T.received)).toMatchObject({ phase: 3, exchanging: true });
    const end = scenePoses(scene, DEMO_DURATION - 1);
    expect(end).toMatchObject({ phase: 5, sender: { point: desks[scene.from].home, walking: false }, receiver: { point: desks[scene.to].home, walking: false } });
    expect(DEMO_DURATION - T.home).toBeGreaterThanOrEqual(6000);
  });
});
