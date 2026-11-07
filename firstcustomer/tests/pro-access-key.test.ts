import { afterEach, describe, expect, it, vi } from "vitest";
import { assertProAccessKey, isProAccessKeyConfigured } from "@/lib/pro-access-key";
import { canActivateProByKey, hasProAccess } from "@/domain/workflow";

afterEach(() => vi.unstubAllEnvs());

describe("Pro 密钥校验", () => {
  const key = "pro-test-only-" + "aB123456".repeat(5);
  it("未配置或配置过短时关闭入口，没有默认通用密钥", () => {
    for (const configured of [undefined, "", "short", "x".repeat(257)]) {
      vi.stubEnv("PRO_ACCESS_KEY", configured);
      expect(isProAccessKeyConfigured()).toBe(false);
      expect(() => assertProAccessKey(key)).toThrow("暂未启用");
    }
  });
  it("只接受配置密钥，区分大小写并容许粘贴时的首尾空白", () => {
    vi.stubEnv("PRO_ACCESS_KEY", key);
    expect(isProAccessKeyConfigured()).toBe(true);
    expect(() => assertProAccessKey(`  ${key}\n`)).not.toThrow();
    for (const invalid of [null, {}, "", key.toLowerCase(), key + "x", "x".repeat(257)]) {
      expect(() => assertProAccessKey(invalid)).toThrow("Pro 密钥无效");
    }
    vi.stubEnv("PRO_ACCESS_KEY", "rotated-test-key-" + "x".repeat(32));
    expect(() => assertProAccessKey(key)).toThrow("Pro 密钥无效");
  });
});

describe("Pro 项目权限", () => {
  const project = { productPlan: "free" as const, requiresPayment: true, status: "free_ready", paused: false, isOwnProduct: false, failedFrom: null };
  it("密钥和实收两种开通均可访问 Pro，申请报价或只有套餐标记不算开通", () => {
    const pro = { ...project, productPlan: "pro" as const };
    expect(hasProAccess(project, { status: "paid" })).toBe(false);
    for (const order of [null, { status: "inquiry" }, { status: "accepted" }, { status: "key_activated" }]) {
      expect(hasProAccess(pro, order)).toBe(false);
    }
    expect(hasProAccess(pro, { status: "paid" })).toBe(true);
    expect(hasProAccess({ ...pro, requiresPayment: false }, { status: "key_activated" })).toBe(true);
    expect(hasProAccess({ ...pro, requiresPayment: false }, null)).toBe(false);
  });
  it("只在初检完成或等待商业确认时开通，不打断运行或暂停的项目", () => {
    expect(canActivateProByKey(project)).toBe(true);
    expect(canActivateProByKey({ ...project, paused: true })).toBe(false);
    expect(canActivateProByKey({ ...project, isOwnProduct: true })).toBe(false);
    for (const status of ["submitted", "researching", "needs_info", "failed", "cancelled"]) {
      expect(canActivateProByKey({ ...project, status })).toBe(false);
    }
    const pro = { ...project, productPlan: "pro" as const };
    for (const status of ["awaiting_quote", "awaiting_quote_acceptance", "awaiting_payment"]) {
      expect(canActivateProByKey({ ...pro, status })).toBe(true);
    }
    for (const status of ["drafting_quote", "reading_receipt", "strategizing", "delivered", "cancelled"]) {
      expect(canActivateProByKey({ ...pro, status })).toBe(false);
    }
    expect(canActivateProByKey({ ...pro, status: "failed", failedFrom: "drafting_quote" })).toBe(true);
    expect(canActivateProByKey({ ...pro, status: "failed", failedFrom: "researching" })).toBe(false);
  });
});
