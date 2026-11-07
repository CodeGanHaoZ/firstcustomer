import { describe, expect, it } from "vitest";
import { customerReturnTo, ownerReturnTo } from "@/lib/auth-return";

const id = "12345678-1234-4321-abcd-123456789abc";
describe("登录上下文与角色隔离", () => {
  it("客户登录后回到自己的项目入口，并保留页面上下文", () => {
    const path = `/p/account.${id}?tab=delivery#acceptance`;
    expect(customerReturnTo(path)).toBe(path);
    expect(customerReturnTo("/projects/new")).toBe("/projects/new");
    expect(customerReturnTo("/admin/access")).toBe("/account");
    expect(customerReturnTo("/p/account.invalid")).toBe("/account");
  });
  it("老板返回合法内部页面，不能进入客户确认入口或登录循环", () => {
    for (const path of ["/admin/access", "/admin/audit?role=founder", `/admin/projects/${id}`, "/admin/payment"]) {
      expect(ownerReturnTo(path)).toBe(path);
    }
    expect(ownerReturnTo(`/p/account.${id}`)).toBe("/admin/owner");
    expect(ownerReturnTo("/admin/login")).toBe("/admin/owner");
  });
  it("拒绝外站重定向、协议混淆、控制字符和非法参数", () => {
    for (const value of [undefined, null, [], ["/account"], "https://evil.invalid/account", "//evil.invalid/account", "/\\evil.invalid/account", "/%2f%2fevil.invalid/account", "/account\n", "/account\0", "javascript:alert(1)", "/api/auth/sign-out", "/" + "a".repeat(2001)]) {
      expect(customerReturnTo(value)).toBe("/account");
      expect(ownerReturnTo(value)).toBe("/admin/owner");
    }
  });
});
