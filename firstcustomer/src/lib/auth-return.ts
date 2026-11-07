const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const customerPaths = new RegExp(`^(?:/account(?:/(?:pro|upgrade))?|/projects/new|/p/account\\.${UUID})$`, "i");
const ownerPaths = new RegExp(`^/admin(?:/(?:owner|audit|access|metrics|tasks|reports|payment|context|knowledge(?:/${UUID})?|projects/(?:new|${UUID}(?:/preview)?)))?$`, "i");

function safeReturn(value: unknown, paths: RegExp, fallback: string) {
  if (typeof value !== "string" || value.length > 2000 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || !paths.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export const customerReturnTo = (value: unknown) => safeReturn(value, customerPaths, "/account");
export function customerLandingPath(value: unknown, plan: "free" | "pro") {
  const path = customerReturnTo(value);
  return path === "/account" && plan === "pro" ? "/account/pro" : path;
}
export const ownerReturnTo = (value: unknown) => safeReturn(value, ownerPaths, "/admin/owner");
