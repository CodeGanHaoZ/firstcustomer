import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const base = "http://127.0.0.1:3100";
const fixture = JSON.parse(readFileSync(".local-test-accounts.json", "utf8")) as { accounts: { email: string; password: string; plan: "pro" | "free"; projectId: string }[] };
const results: { check: string; passed: boolean; status?: number }[] = [];
const cookieFor = new Map<string, string>();
const get = (path: string, cookie = "") => fetch(base + path, { headers: cookie ? { cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(30_000) });
function check(name: string, passed: boolean, status?: number) { results.push({ check: name, passed, status }); assert(passed, name); }
async function redirectTarget(response: Response) {
  const location = response.headers.get("location");
  if (location) return location;
  const doc = new JSDOM(await response.text()).window.document;
  return doc.querySelector('meta[http-equiv="refresh"]')?.getAttribute("content")?.split("url=")[1] ?? "";
}

try {
  for (const account of fixture.accounts) {
    const response = await fetch(base + "/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(30_000) });
    check(`${account.email}: login`, response.status === 200, response.status);
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    check(`${account.email}: session`, Boolean(cookie)); cookieFor.set(account.email, cookie);
    const workspace = await get("/account", cookie);
    check(`${account.email}: server plan routing`, account.plan === "pro" ? workspace.status === 307 && workspace.headers.get("location") === "/account/pro" : workspace.status === 200, workspace.status);
    const pro = await get("/account/pro", cookie);
    check(`${account.email}: Pro access gate`, account.plan === "pro" ? pro.status === 200 : pro.status === 307 && pro.headers.get("location") === "/account/upgrade", pro.status);
    const project = await get(`/p/account.${account.projectId}`, cookie);
    check(`${account.email}: own project`, project.status === 200, project.status);
    const doc = new JSDOM(await project.text()).window.document;
    const progress = doc.querySelector('[aria-labelledby="customer-progress-title"]')?.textContent ?? "";
    check(`${account.email}: matching project workflow`, account.plan === "pro" ? progress.includes("Pro 工作模块已开通") : progress.includes("免费"));
    const other = fixture.accounts.find((item) => item.email !== account.email)!;
    const foreign = await get(`/p/account.${other.projectId}`, cookie);
    check(`${account.email}: foreign project denied`, foreign.status === 404, foreign.status);
    for (const path of ["/admin/owner", "/admin/access", "/admin/audit", "/admin/status"]) {
      const internal = await get(path, cookie);
      check(`${account.email}: internal access denied ${path}`, internal.status === 401 || (await redirectTarget(internal)).startsWith("/admin/login"), internal.status);
    }
  }
  const anonymousPro = await get("/account/pro");
  check("anonymous: Pro requires login", anonymousPro.status === 307 && Boolean(anonymousPro.headers.get("location")?.includes("/login")), anonymousPro.status);
  check("anonymous: trial remains available", (await get("/account")).status === 200);
  check("cron: requires service credential", (await get("/api/jobs/daily")).status === 401);
  const ownerPage = await get("/admin/login"); const ownerDoc = new JSDOM(await ownerPage.text()).window.document;
  const form = [...ownerDoc.querySelectorAll("form")].find((item) => item.querySelector('input[name="username"]'));
  const actionName = form?.querySelector<HTMLInputElement>('input[name^="$ACTION_ID_"]')?.name;
  check("owner: independent login form", Boolean(actionName));
  const body = new FormData(); body.set(actionName!, ""); body.set("username", process.env.ADMIN_USERNAME ?? "hifirst"); body.set("password", process.env.ADMIN_PASSWORD ?? "");
  const ownerLogin = await fetch(base + "/admin/login", { method: "POST", headers: { Origin: base }, body, redirect: "manual" });
  check("owner: valid internal credential", ownerLogin.status === 303 && Boolean(ownerLogin.headers.get("location")?.startsWith("/admin")), ownerLogin.status);
  const ownerCookie = ownerLogin.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  for (const path of ["/admin", "/admin/owner", "/admin/access", "/admin/audit", "/admin/tasks", "/admin/reports", "/admin/metrics", "/admin/knowledge", "/admin/payment", "/admin/context", "/admin/status"]) {
    const response = await get(path, ownerCookie); check(`owner: ${path}`, response.status === 200, response.status);
  }
  const ownerAccount = await get("/account/pro", ownerCookie);
  check("owner: internal session does not impersonate a customer", ownerAccount.status === 307 && Boolean(ownerAccount.headers.get("location")?.includes("/login")), ownerAccount.status);
} finally {
  const directory = resolve("../reports/source-flow-audit-2026-11-08"); mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "role-http-checks.json"), JSON.stringify({ scope: "Local HTTP role and workspace checks; credentials and cookies omitted", checks: results }, null, 2) + "\n");
  console.log(JSON.stringify({ checks: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).map((item) => item.check) }));
}
