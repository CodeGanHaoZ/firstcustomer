import { describe, expect, it } from "vitest";
import { translateUi } from "@/lib/ui-translation";
import { localeFrom } from "@/lib/locale";
import { INTAKE_STEPS, INTAKE_STAGES, INTAKE_GOALS, emptyIntakeDraft, intakeQuestion, parseIntakeDraft, serializeIntakeDraft } from "@/lib/project-intake";
import { customerProgress } from "@/domain/customer-progress";
import { STATUS_LABELS } from "@/domain/workflow";
import { AGENT_LABELS, AGENT_STATE_LABELS, TASK_STATUS_LABELS, TASK_TRIGGER_LABELS, DEPARTMENTS } from "@/domain/office";
import { KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES } from "@/knowledge/types";
import { REQUIREMENT_ROUTES } from "@/domain/requirements";

const han = /[\u3400-\u9fff]/;

describe("site language", () => {
  it("only accepts the supported language cookie values", () => {
    expect(localeFrom("en")).toBe("en");
    for (const input of [undefined, "zh", "en-US", "EN", "<script>"]) expect(localeFrom(input)).toBe("zh");
  });

  it("covers every intake question, option, hint, and shared status label", () => {
    const messages: string[] = [...INTAKE_STAGES, ...INTAKE_GOALS, ...Object.values(STATUS_LABELS),
      ...Object.values(AGENT_LABELS), ...Object.values(AGENT_STATE_LABELS), ...Object.values(TASK_STATUS_LABELS),
      ...Object.values(TASK_TRIGGER_LABELS), ...Object.values(KNOWLEDGE_AGENTS), ...Object.values(KNOWLEDGE_CATEGORIES),
      ...Object.values(REQUIREMENT_ROUTES), ...DEPARTMENTS.flatMap((entry) => [entry.room, entry.agent, entry.duty])];
    for (const step of INTAKE_STEPS) {
      messages.push(step.label, step.question, step.help);
      if ("placeholder" in step) messages.push(step.placeholder);
      if ("skip" in step) messages.push(step.skip);
      for (const stage of INTAKE_STAGES) for (const goal of INTAKE_GOALS) {
        messages.push(intakeQuestion(step.field, step.question, { ...emptyIntakeDraft().answers, stage, goal }));
      }
    }
    const missing = [...new Set(messages)].filter((text) => han.test(translateUi("en", text)));
    expect(missing).toEqual([]);
  });

  it("covers customer progress across working, paused, approval, and delivery states", () => {
    const missing = new Set<string>();
    for (const status of Object.keys(STATUS_LABELS)) for (const paused of [false, true]) {
      for (const runningAgents of [[], ["research", "quote", "receipt", "strategy", "launch", "growth"], ["vision"]]) {
        for (const openGate of [null, "positioning", "publish", "next_round"] as const) {
          for (const reportReady of [false, true]) for (const canStartFree of [false, true]) {
            const progress = customerProgress({ status, paused, runningAgents, openGate, reportReady, canStartFree,
              quoteVisible: true, awaitingPayment: true, receiptUploaded: false, deliveryStatus: "delivered" });
            for (const text of [progress.title, progress.detail, progress.action?.label ?? ""]) {
              if (han.test(translateUi("en", text))) missing.add(text);
            }
          }
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("leaves Chinese and unknown customer content verbatim, including template payloads", () => {
    for (const text of ["产品名称或想法", "My demo", "客户的自定义产品与研究原文", "首批用户验证：保留我的产品名称", "__proto__"]) {
      expect(translateUi("zh", text)).toBe(text);
    }
    for (const text of ["My demo", "客户的自定义产品与研究原文", "首批用户验证：保留我的产品名称", "__proto__"]) {
      expect(translateUi("en", text)).toBe(text);
    }
    expect(translateUi("en", "项目登记 · 2 / 11")).toBe("Project details · 2 / 11");
    expect(translateUi("en", "你提交的预算和时间要求为「保留原文 ¥1000」。")).toContain("保留原文 ¥1000");
  });

  it("translates visible choices while retaining the existing draft and submission values", () => {
    const draft = emptyIntakeDraft();
    Object.assign(draft.answers, { productName: "我的工具", stage: "已有 MVP", goal: "找首批用户" });
    expect(translateUi("en", draft.answers.stage)).toBe("Have an MVP");
    expect(translateUi("en", draft.answers.goal)).not.toMatch(han);
    expect(parseIntakeDraft(serializeIntakeDraft(draft)).answers).toEqual(draft.answers);
  });
});
