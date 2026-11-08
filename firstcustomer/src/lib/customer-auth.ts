import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getSessionCookie } from "better-auth/cookies";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db";
import { authAccounts, authRateLimits, authSessions, authUsers, authVerifications } from "@/db/customer-auth-schema";
import { customerAuthBaseURL } from "./customer-auth-url";

function createCustomerAuth() {
  return betterAuth({
    appName: "首客 HiFirst",
    baseURL: customerAuthBaseURL(),
    secret: process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      transaction: true,
      schema: { user: authUsers, session: authSessions, account: authAccounts, verification: authVerifications, rateLimit: authRateLimits },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-up/email": { window: 600, max: 8 },
        "/sign-in/email": { window: 60, max: 12 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: [process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "x-forwarded-for"] },
    },
    plugins: [nextCookies()],
  });
}

let auth: ReturnType<typeof createCustomerAuth> | undefined;

export function getCustomerAuth() {
  return auth ??= createCustomerAuth();
}

export const getCustomerSession = cache(async () => {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders)) return null;
  return getCustomerAuth().api.getSession({ headers: requestHeaders });
});
