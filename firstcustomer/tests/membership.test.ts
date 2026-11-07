import { describe, expect, it } from "vitest";
import { customerLandingPath } from "@/lib/auth-return";
import { effectiveCustomerPlan } from "@/domain/membership";
import { decisionError, founderReady, gateState } from "@/domain/approval";
import { hasProAccess, isAccountPro, isKeyActivatedPro } from "@/domain/workflow";

describe("账号版本与工作模块入口", () => {
  it("从服务端权益判断版本，过期、撤销和缺失都回到 Free", () => {
    const active = { plan: "pro" as const, status: "active" as const, source: "test" as const, expiresAt: null };
    expect(effectiveCustomerPlan(active)).toBe("pro");
    expect(effectiveCustomerPlan(null)).toBe("free");
    expect(effectiveCustomerPlan({ ...active, status: "revoked" })).toBe("free");
    expect(effectiveCustomerPlan({ ...active, expiresAt: new Date(0) })).toBe("free");
  });
  it("登录按账号版本分流，保留合法原项目入口，拒绝跳转老板工作台", () => {
    expect(customerLandingPath("/account", "pro")).toBe("/account/pro");
    expect(customerLandingPath("/account", "free")).toBe("/account");
    expect(customerLandingPath("/admin/owner", "pro")).toBe("/account/pro");
    expect(customerLandingPath("/projects/new", "pro")).toBe("/projects/new");
    expect(customerLandingPath("https://evil.invalid", "free")).toBe("/account");
  });
  it("账号授权、密钥授权和实际付款不是同一种开通记录", () => {
    const project = { productPlan: "pro" as const, requiresPayment: false, proAccessSource: "account" };
    expect(isAccountPro(project)).toBe(true); expect(isKeyActivatedPro(project)).toBe(false);
    expect(hasProAccess(project, { status: "account_active" })).toBe(true);
    expect(hasProAccess(project, { status: "key_activated" })).toBe(false);
    expect(hasProAccess({ ...project, proAccessSource: null }, { status: "account_active" })).toBe(false);
  });
  it("Pro 自助流程仍要求客户确认，不伪造老板批准，也不放宽旧项目", () => {
    const waiting = gateState([], "positioning", 1, false);
    expect(waiting.founder).toBe("pending"); expect(waiting.complete).toBe(false);
    expect(founderReady(waiting)).toBe(true); expect(decisionError(waiting, "customer")).toBeNull();
    expect(decisionError(waiting, "founder")).toBeTruthy();
    expect(decisionError(gateState([], "positioning", 1), "customer")).toBeTruthy();
    const decisions = [{ gate: "positioning", subjectVersion: 1, actorRole: "customer", verdict: "approve", createdAt: new Date() }];
    expect(gateState(decisions, "positioning", 1, false).complete).toBe(true);
    expect(gateState(decisions, "positioning", 1).complete).toBe(false);
  });
});
