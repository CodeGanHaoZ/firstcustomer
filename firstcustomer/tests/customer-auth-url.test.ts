import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth/minimal";
import { customerAuthBaseURL } from "@/lib/customer-auth-url";

describe("客户登录域名", () => {
  const env = { VERCEL_PROJECT_PRODUCTION_URL: "www.example.com", VERCEL_URL: "app-commit.vercel.app", VERCEL_BRANCH_URL: "app-git-main.vercel.app", BETTER_AUTH_ALLOWED_HOSTS: " app.vercel.app,example.com,www.example.com, " };
  it("保留主域名、发布与分支域名，并显式支持其他本站别名", () => {
    expect(customerAuthBaseURL(env)).toEqual({ allowedHosts: ["www.example.com", "app-commit.vercel.app", "app-git-main.vercel.app", "app.vercel.app", "example.com"], protocol: "https" });
    expect(customerAuthBaseURL({ BETTER_AUTH_URL: "https://fixed.example.com", ...env })).toBe("https://fixed.example.com");
    expect(customerAuthBaseURL({ DOMAIN: "self-hosted.example.com" })).toBe("https://self-hosted.example.com");
    expect(customerAuthBaseURL({})).toMatchObject({ protocol: "http", allowedHosts: expect.arrayContaining(["localhost:*", "127.0.0.1:*"]) });
  });
  it("本站别名的真实会话端点返回匿名会话，其他站点域名仍被拒绝", async () => {
    const auth = betterAuth({ baseURL: customerAuthBaseURL(env), secret: "isolated-auth-host-test-secret-with-at-least-32-characters", rateLimit: { enabled: false } });
    for (const host of ["www.example.com", "example.com", "app.vercel.app", "app-commit.vercel.app", "app-git-main.vercel.app"]) {
      const response = await auth.handler(new Request(`https://${host}/api/auth/get-session`));
      expect(response.status).toBe(200); expect(await response.json()).toBeNull();
    }
    await expect(auth.handler(new Request("https://unrelated.vercel.app/api/auth/get-session"))).rejects.toThrow("allowed hosts");
  });
  it("别名登录接受本站来源，仍拒绝外站来源", async () => {
    const auth = betterAuth({ baseURL: customerAuthBaseURL(env), secret: "isolated-auth-host-test-secret-with-at-least-32-characters", emailAndPassword: { enabled: true }, advanced: { disableOriginCheck: false, disableCSRFCheck: false }, rateLimit: { enabled: false } });
    const signIn = (origin: string) => auth.handler(new Request("https://app.vercel.app/api/auth/sign-in/email", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: "fc_pro_trial_visitor=existing-browser-cookie" },
      body: JSON.stringify({ email: "nonexistent@example.test", password: "not-a-real-account-password" }),
    }));
    expect((await signIn("https://app.vercel.app")).status).toBe(401);
    expect((await signIn("https://unrelated.vercel.app")).status).toBe(403);
  });
});
