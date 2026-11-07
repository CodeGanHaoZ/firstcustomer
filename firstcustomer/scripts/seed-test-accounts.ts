import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { authAccounts, authUsers, customerMemberships, decisions, orders, projects } from "../src/db/schema";
import { createProject } from "../src/workflow/actions";

if (process.env.NODE_ENV === "production") throw new Error("测试账号初始化仅用于本地或独立测试环境");
if (!process.env.DATABASE_URL) throw new Error("缺少 DATABASE_URL");
const path = resolve(".local-test-accounts.json");
type Saved = { email: string; password: string; projectId: string; plan: "free" | "pro"; name: string };
let previous: Saved[] = [];
if (existsSync(path)) previous = JSON.parse(readFileSync(path, "utf8")).accounts ?? [];
const { db, sql } = createDb(process.env.DATABASE_URL);
const accounts: Saved[] = [];
try {
  for (const plan of ["pro", "free"] as const) for (const number of [1, 2]) {
    const email = `${plan}${number}@hifirst.test`;
    const name = `${plan === "pro" ? "Pro" : "Free"} 测试用户 ${number}`;
    const old = previous.find((item) => item.email === email);
    const password = old?.password || randomBytes(18).toString("base64url");
    const hash = await hashPassword(password);
    const userId = await db.transaction(async (tx) => {
      let [user] = await tx.select().from(authUsers).where(eq(authUsers.email, email));
      if (user) {
        const [managed] = await tx.select().from(customerMemberships).where(eq(customerMemberships.customerId, user.id));
        if (!managed?.testAccount) throw new Error(`目标邮箱不是本脚本管理的测试账号：${email}`);
      } else {
        [user] = await tx.insert(authUsers).values({ id: randomUUID(), email, name, emailVerified: false }).returning();
      }
      const [credential] = await tx.select().from(authAccounts).where(and(eq(authAccounts.userId, user.id), eq(authAccounts.providerId, "credential")));
      if (credential) await tx.update(authAccounts).set({ password: hash, updatedAt: new Date() }).where(eq(authAccounts.id, credential.id));
      else await tx.insert(authAccounts).values({ id: randomUUID(), accountId: user.id, userId: user.id, providerId: "credential", password: hash });
      await tx.insert(customerMemberships).values({ customerId: user.id, plan, source: "test", testAccount: true })
        .onConflictDoUpdate({ target: customerMemberships.customerId, set: { plan, source: "test", status: "active", expiresAt: null, testAccount: true, updatedAt: new Date() } });
      return user.id;
    });
    const productName = `【测试】${plan.toUpperCase()} 示例项目 ${number}`;
    let [project] = await db.select().from(projects).where(and(eq(projects.customerId, userId), eq(projects.productName, productName)));
    if (!project) {
      const created = await createProject(db, { productName, customerId: userId, productPlan: "free", stage: "已有 MVP", goal: "验证", contact: "测试资料，无需联系", targetMarket: "待验证", constraints: "测试示例；尚未运行模型，不代表真实研究、交易或增长。" });
      project = created.project;
      if (plan === "pro") await db.transaction(async (tx) => {
        await tx.update(projects).set({ productPlan: "pro", requiresPayment: false, proAccessSource: "account" }).where(eq(projects.id, project.id));
        await tx.insert(orders).values({ projectId: project.id, sku: "Pro 测试账号权益", status: "account_active" });
        await tx.insert(decisions).values({ projectId: project.id, gate: "pro_access", subjectVersion: project.scopeVersion, actorRole: "customer", verdict: "approve",
          reason: "测试账号示例项目，等待用户进入模块后启动，不计入实收", snapshot: { method: "account", customerId: userId, source: "test", testAccount: true } });
      });
    }
    accounts.push({ email, password, projectId: project.id, plan, name });
  }
  writeFileSync(path, JSON.stringify({ loginUrl: "http://127.0.0.1:3100/login", createdFor: "本地 Free / Pro 分流与权限检查", accounts }, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
  console.log(`已准备 ${accounts.length} 个测试账号。密码保存在 ${path}。未发起模型任务、付款或收入记录。`);
} finally { await sql.end(); }
