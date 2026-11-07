import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());
const setCookie = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (key: string) => store.has(key) ? { value: store.get(key) } : undefined,
  set: (key: string, value: string, options: unknown) => { store.set(key, value); setCookie(key, value, options); },
  delete: (key: string) => store.delete(key),
}) }));

import { adminCredentialsMatch, endAdminSession, getOwnerIdentity, hasAdminSession, isAdmin, requireAdmin, startAdminSession } from "@/lib/auth";
import { hasOwnerPermission, OWNER_PERMISSION_KEYS, type OwnerPermission } from "@/domain/owner-permissions";
import { parseTrialTokens, rememberTrialProject, trialProjectTokens, TRIAL_PROJECTS_COOKIE } from "@/lib/trial-projects";

beforeEach(() => {
  store.clear(); setCookie.mockClear();
  vi.stubEnv("ADMIN_USERNAME", "hifirst");
  vi.stubEnv("ADMIN_PASSWORD", "test-password-not-for-use");
  vi.stubEnv("SESSION_SECRET", "test-session-secret-with-at-least-32-characters");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("试用入口凭据", () => {
  it("拒绝异常 Cookie，并只保留有效且不重复的项目凭据", () => {
    for (const value of [undefined, "invalid", "{}", "[]", "x".repeat(3000), '["account.project-id",42]']) {
      expect(parseTrialTokens(value)).toEqual([]);
    }
    const token = "a".repeat(43);
    expect(parseTrialTokens(JSON.stringify([token, token, "not-a-capability"]))).toEqual([token]);
  });
  it("保留当前浏览器最近项目，并使用 HttpOnly Cookie", async () => {
    for (let index = 0; index < 14; index++) await rememberTrialProject(String(index).padStart(43, "a"));
    const tokens = await trialProjectTokens();
    expect(tokens).toHaveLength(12);
    expect(tokens[0]).toBe("13".padStart(43, "a"));
    expect(tokens).not.toContain("0".padStart(43, "a"));
    expect(setCookie).toHaveBeenLastCalledWith(TRIAL_PROJECTS_COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true, maxAge: 30 * 24 * 3600 }));
  });
});

describe("首客独立账号", () => {
  it("由签名会话分配公司经营者身份，所有内部操作都要匹配已知权限", async () => {
    expect(await getOwnerIdentity()).toBeNull();
    await startAdminSession();
    expect(await getOwnerIdentity()).toEqual({ username: "hifirst", role: "owner", permissions: OWNER_PERMISSION_KEYS });
    for (const permission of OWNER_PERMISSION_KEYS) expect((await requireAdmin(permission)).role).toBe("owner");
    await expect(requireAdmin("unlisted.operation" as OwnerPermission)).rejects.toThrow("没有这项内部操作权限");
    for (const role of ["customer", "provider", "requester", "admin", undefined]) {
      for (const permission of OWNER_PERMISSION_KEYS) expect(hasOwnerPermission(role, permission)).toBe(false);
    }
    expect(hasOwnerPermission("owner", "__proto__")).toBe(false);
  });
  it("同时验证账号和密码，未配置密码时拒绝登录", () => {
    expect(adminCredentialsMatch("hifirst", "test-password-not-for-use")).toBe(true);
    expect(adminCredentialsMatch("other", "test-password-not-for-use")).toBe(false);
    expect(adminCredentialsMatch("hifirst", "wrong")).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(adminCredentialsMatch("hifirst", "")).toBe(false);
  });
  it("游客或客户会话不会取得内部权限，旧免密码配置也不生效", async () => {
    vi.stubEnv("ADMIN_NO_PASSWORD", "1");
    store.set("fc_trial_projects", JSON.stringify(["a".repeat(43)]));
    store.set("better-auth.session_token", "customer-session");
    expect(await isAdmin()).toBe(false);
  });
  it("签发受保护的会话，退出后失效", async () => {
    await startAdminSession();
    expect(await hasAdminSession()).toBe(true);
    expect(setCookie).toHaveBeenCalledWith("fc_admin", expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
    await endAdminSession();
    expect(await hasAdminSession()).toBe(false);
  });
  it("修改内部账号或密码后，旧会话立即失效", async () => {
    await startAdminSession();
    vi.stubEnv("ADMIN_PASSWORD", "rotated-password");
    expect(await hasAdminSession()).toBe(false);
    await startAdminSession();
    vi.stubEnv("ADMIN_USERNAME", "changed-owner");
    expect(await hasAdminSession()).toBe(false);
  });
  it("拒绝篡改、过期和格式错误的会话", async () => {
    vi.useFakeTimers();
    await startAdminSession();
    vi.advanceTimersByTime(8 * 24 * 3600 * 1000);
    expect(await hasAdminSession()).toBe(false);
    for (const invalid of ["broken", "9999999999999." + "0".repeat(64), "99999999999." + "0".repeat(64)]) {
      store.set("fc_admin", invalid);
      expect(await hasAdminSession()).toBe(false);
    }
  });
});
