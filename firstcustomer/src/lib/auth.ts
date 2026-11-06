import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "fc_admin";
const MAX_AGE_SECONDS = 7 * 24 * 3600;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET 至少需要 32 个字符");
  }
  return value;
}

const signature = (expires: string) =>
  createHmac("sha256", secret()).update(expires).digest("hex");

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export function passwordMatches(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("缺少 ADMIN_PASSWORD");
  return timingSafeEqual(sha256(input), sha256(expected));
}

export async function startAdminSession() {
  const expires = String(Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS);
  const store = await cookies();
  store.set(COOKIE, `${expires}.${signature(expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

// 本机开发可免密码进入经营台；生产环境即使误设了也不生效，避免客户数据公开。
export function passwordDisabled() {
  return process.env.ADMIN_NO_PASSWORD === "1" && process.env.NODE_ENV !== "production";
}

export async function isAdmin() {
  return passwordDisabled() || (await hasAdminSession());
}

// 只看真实登录的会话，用来在统计里排除首客自己的访问。
export async function hasAdminSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expires, mac] = value.split(".");
  if (!expires || !mac || Number(expires) < Date.now() / 1000) return false;
  const expected = Buffer.from(signature(expires));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
