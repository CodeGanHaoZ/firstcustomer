import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const PRO_TRIAL_VISITOR_COOKIE = "fc_pro_trial_visitor";
const MAX_AGE = 365 * 24 * 3600;

export function proTrialVisitorHash(value: string | undefined) {
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? createHash("sha256").update(value).digest("hex") : null;
}

export async function currentProTrialVisitor() {
  return proTrialVisitorHash((await cookies()).get(PRO_TRIAL_VISITOR_COOKIE)?.value);
}

// Only call from a Server Action: page reads must not create identities or claims.
export async function ensureProTrialVisitor() {
  const store = await cookies();
  const existing = proTrialVisitorHash(store.get(PRO_TRIAL_VISITOR_COOKIE)?.value);
  if (existing) return existing;
  const value = randomBytes(32).toString("base64url");
  store.set(PRO_TRIAL_VISITOR_COOKIE, value, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE,
    secure: process.env.COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production",
  });
  return proTrialVisitorHash(value)!;
}
