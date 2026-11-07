import { describe, expect, it } from "vitest";
import { emptyIntakeDraft, intakeAnswerError, parseIntakeDraft, serializeIntakeDraft } from "@/lib/project-intake";

describe("public intake draft recovery", () => {
  it("recovers existing flat drafts without accepting invalid choice values", () => {
    const draft = parseIntakeDraft(JSON.stringify({ productName: "Demo", stage: "已有 MVP", goal: "unknown", contact: ["bad"], productUrl: "https://example.com" }));
    expect(draft.answers).toMatchObject({ productName: "Demo", stage: "已有 MVP", goal: "", contact: "", productUrl: "https://example.com" });
    expect(draft.step).toBe(0);
  });

  it("resumes the review and remembers that screenshots need to be selected again", () => {
    const draft = emptyIntakeDraft();
    Object.assign(draft.answers, { productName: "Demo", stage: "已上线", goal: "验证", contact: "test@example.com" });
    Object.assign(draft, { step: 8, reached: 8, hadImages: true });
    expect(parseIntakeDraft(serializeIntakeDraft(draft))).toEqual(draft);
  });

  it("returns partial or damaged review drafts to the first invalid required answer", () => {
    const draft = parseIntakeDraft(JSON.stringify({ productName: "Demo", stage: "已有 MVP", __step: 100, __reached: 100 }));
    expect(draft.step).toBe(2);
    expect(draft.reached).toBe(8);
    for (const raw of [null, "{", "[]", "null", '"text"']) expect(parseIntakeDraft(raw)).toEqual(emptyIntakeDraft());
  });

  it("trims untrusted stored text to field limits", () => {
    expect(parseIntakeDraft(JSON.stringify({ productName: "a".repeat(600), contact: "b".repeat(300) })).answers.productName).toHaveLength(500);
    expect(parseIntakeDraft(JSON.stringify({ contact: "b".repeat(300) })).answers.contact).toHaveLength(200);
  });
});

describe("guided intake validation", () => {
  it("requires meaningful text and valid stage/goal selections", () => {
    expect(intakeAnswerError("productName", "   ")).toBeTruthy();
    expect(intakeAnswerError("contact", "ab")).toBeTruthy();
    expect(intakeAnswerError("stage", "unexpected")).toBeTruthy();
    expect(intakeAnswerError("goal", "找首批用户")).toBe("");
  });

  it("accepts skipped optional fields and only full HTTP product URLs", () => {
    expect(intakeAnswerError("productUrl", "")).toBe("");
    expect(intakeAnswerError("targetMarket", "")).toBe("");
    expect(intakeAnswerError("productUrl", "https://example.com/demo?q=1")).toBe("");
    for (const url of ["example.com", "javascript:alert(1)", "data:text/plain,test", "ftp://example.com"]) expect(intakeAnswerError("productUrl", url)).toBeTruthy();
  });
});
