import type { BetterAuthOptions } from "better-auth/minimal";

export function customerAuthBaseURL(env: Partial<NodeJS.ProcessEnv> = process.env): BetterAuthOptions["baseURL"] {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  // Vercel's primary production URL omits secondary aliases. Keep those explicit
  // instead of trusting the inbound Host or allowing every *.vercel.app site.
  const aliases = (env.BETTER_AUTH_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean);
  const allowedHosts = [...new Set([env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL, env.VERCEL_BRANCH_URL, ...aliases]
    .filter((host): host is string => Boolean(host)))];
  if (allowedHosts.length) return { allowedHosts, protocol: "https" };
  if (env.DOMAIN) return `https://${env.DOMAIN}`;
  return { allowedHosts: ["localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"], protocol: "http" };
}
