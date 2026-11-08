import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const findByToken = vi.hoisted(() => vi.fn());
vi.mock("@/lib/customer-auth", () => ({ getCustomerSession: getSession }));
vi.mock("@/workflow/actions", () => ({ findProjectByToken: findByToken }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { findCustomerProject, requireCustomerProjectSession } from "@/lib/customer-project";
import type { Db } from "@/db";

const token = "account.12345678-1234-4321-abcd-123456789abc";
beforeEach(() => { getSession.mockReset(); findByToken.mockReset(); });
describe("客户项目会话连续性", () => {
  it("会话过期时要求登录，并带回原项目路径", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireCustomerProjectSession(token)).rejects.toThrow(`REDIRECT:/login?next=${encodeURIComponent(`/p/${token}`)}`);
  });
  it("有效客户会话继续检查项目归属，不提升为老板", async () => {
    getSession.mockResolvedValue({ user: { id: "customer-a" } });
    await expect(requireCustomerProjectSession(token)).resolves.toBeUndefined();
    const where = vi.fn().mockResolvedValue([]);
    const db = { select: () => ({ from: () => ({ where }) }) } as unknown as Db;
    expect(await findCustomerProject(db, token)).toBeNull();
    expect(where).toHaveBeenCalledOnce();
    expect(findByToken).not.toHaveBeenCalled();
  });
  it("已有访客凭据继续使用原有校验，不强制注册", async () => {
    await expect(requireCustomerProjectSession("a".repeat(43))).resolves.toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });
  it("账号 Pro 项目的旧访客链接不能绕过登录与归属验证", async () => {
    const project = { customerId: "customer-a", productPlan: "pro", requiresPayment: false, proAccessSource: "account" };
    findByToken.mockResolvedValue(project);
    getSession.mockResolvedValue(null);
    expect(await findCustomerProject({} as Db, "a".repeat(43))).toBeNull();
    getSession.mockResolvedValue({ user: { id: "customer-b" } });
    expect(await findCustomerProject({} as Db, "a".repeat(43))).toBeNull();
    getSession.mockResolvedValue({ user: { id: "customer-a" } });
    expect(await findCustomerProject({} as Db, "a".repeat(43))).toEqual(project);
  });
  it("已归属账号的购买项目要求本人登录，未归属的访客购买仍用专属凭据", async () => {
    const project = { customerId: "customer-a", productPlan: "pro", requiresPayment: false, proAccessSource: "simulation" };
    findByToken.mockResolvedValue(project);
    getSession.mockResolvedValue({ user: { id: "customer-b" } });
    expect(await findCustomerProject({} as Db, "a".repeat(43))).toBeNull();
    getSession.mockResolvedValue({ user: { id: "customer-a" } });
    expect(await findCustomerProject({} as Db, "a".repeat(43))).toEqual(project);
    findByToken.mockResolvedValue({ ...project, customerId: null });
    getSession.mockResolvedValue(null);
    expect(await findCustomerProject({} as Db, "a".repeat(43))).toEqual({ ...project, customerId: null });
  });
});
