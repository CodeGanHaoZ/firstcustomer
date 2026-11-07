import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasOwnerPermission, OWNER_PERMISSION_KEYS, type OwnerPermission } from "@/domain/owner-permissions";
import { ownerReturnTo } from "./auth-return";

const COOKIE = "fc_admin";
export const NEW_CUSTOMER_LINK_COOKIE = "fc_new_customer_link";
const MAX_AGE_SECONDS = 7 * 24 * 3600;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET 至少需要 32 个字符");
  }
  return value;
}

const signature = (expires: string) =>
  createHmac("sha256", secret())
    .update(JSON.stringify(["admin-v2", adminUsername(), process.env.ADMIN_PASSWORD ?? "", expires]))
    .digest("hex");

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export function adminUsername() {
  return process.env.ADMIN_USERNAME?.trim() || "hifirst";
}

export function adminCredentialsMatch(username: string, password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const usernameMatches = timingSafeEqual(sha256(username.trim()), sha256(adminUsername()));
  const passwordMatches = timingSafeEqual(sha256(password), sha256(expected));
  return usernameMatches && passwordMatches;
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

export async function isAdmin() {
  return hasAdminSession();
}

// 只看真实登录的会话，用来在统计里排除首客自己的访问。
export async function hasAdminSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || !/^\d{1,12}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, mac] = value.split(".");
  if (!expires || !mac || Number(expires) < Date.now() / 1000) return false;
  const expected = Buffer.from(signature(expires));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function getOwnerIdentity() {
  if (!(await hasAdminSession())) return null;
  return { username: adminUsername(), role: "owner" as const, permissions: OWNER_PERMISSION_KEYS };
}

export async function requireAdmin(permission: OwnerPermission = "workspace.read", returnTo = "/admin/owner") {
  const identity = await getOwnerIdentity();
  if (!identity) redirect(`/admin/login?next=${encodeURIComponent(ownerReturnTo(returnTo))}`);
  if (!hasOwnerPermission(identity.role, permission)) throw new Error("当前账号没有这项内部操作权限");
  return identity;
}
