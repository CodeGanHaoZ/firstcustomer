import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const credentialsPath = fileURLToPath(new URL("../.local-admin-credentials.txt", import.meta.url));
const source = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const env = parseEnv(source);
const args = process.argv.slice(2);
let requestedUsername;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--username") {
    requestedUsername = args[++i];
    if (!requestedUsername || requestedUsername.startsWith("--")) throw new Error("--username 后需要提供账号");
  }
  else if (args[i] !== "--rotate-password") throw new Error("只支持 --username <账号> 和 --rotate-password");
}
const username = requestedUsername ?? env.ADMIN_USERNAME?.trim() ?? "hifirst";
if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,63}$/.test(username)) throw new Error("老板账号需为 3–64 位字母、数字、点、横线或下划线");
const password = args.includes("--rotate-password") || !env.ADMIN_PASSWORD ? randomBytes(24).toString("base64url") : env.ADMIN_PASSWORD;
const sessionSecret = env.SESSION_SECRET?.length >= 32 ? env.SESSION_SECRET : randomBytes(48).toString("base64url");
let updated = source;
for (const [key, value] of Object.entries({ ADMIN_USERNAME: username, ADMIN_PASSWORD: password, SESSION_SECRET: sessionSecret })) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  updated = pattern.test(updated) ? updated.replace(pattern, () => line) : `${updated}${updated.endsWith("\n") ? "" : "\n"}${line}\n`;
}
if (updated !== source) writeFileSync(envPath, updated, { mode: 0o600 });
chmodSync(envPath, 0o600);
writeFileSync(credentialsPath, `首客 OPC 老板账号（仅本机）\n登录地址：http://localhost:3100/admin/login\n账号：${username}\n密码：${password}\n角色：owner（公司经营者）\n权限页：http://localhost:3100/admin/access\n\n请勿提交或公开此文件。账号或密码变更后，需要重启服务，旧老板会话失效。\n`, { mode: 0o600 });
chmodSync(credentialsPath, 0o600);
console.log(`老板账号已分配：${username}（owner）\n凭据保存在：${credentialsPath}\n未把密码输出到终端。配置如有变更，请重启服务。`);
