import { and, desc, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import type { Db } from "@/db";
import { projects } from "@/db/schema";
import { hashToken } from "@/workflow/actions";

export const TRIAL_PROJECTS_COOKIE = "fc_trial_projects";
export const MAX_TRIAL_PROJECTS = 12;
const MAX_AGE_SECONDS = 30 * 24 * 3600;

// These are the same unguessable capabilities as private project links. Only
// hashes are queried; a modified cookie cannot grant access to another project.
export function parseTrialTokens(value: string | undefined): string[] {
  if (!value || value.length > 2048) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((token): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)))].slice(0, MAX_TRIAL_PROJECTS);
  } catch {
    return [];
  }
}

export async function trialProjectTokens() {
  return parseTrialTokens((await cookies()).get(TRIAL_PROJECTS_COOKIE)?.value);
}

export async function rememberTrialProject(token: string) {
  const store = await cookies();
  const tokens = [token, ...parseTrialTokens(store.get(TRIAL_PROJECTS_COOKIE)?.value).filter((previous) => previous !== token)].slice(0, MAX_TRIAL_PROJECTS);
  store.set(TRIAL_PROJECTS_COOKIE, JSON.stringify(tokens), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE_SECONDS,
    secure: process.env.COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production",
  });
}

export async function listTrialProjects(db: Db, tokens: string[]) {
  if (!tokens.length) return [];
  const byHash = new Map(tokens.map((token) => [hashToken(token), token]));
  const found = await db.select({
    id: projects.id, productName: projects.productName, status: projects.status,
    paused: projects.paused, updatedAt: projects.updatedAt, tokenHash: projects.tokenHash,
  }).from(projects).where(and(isNull(projects.customerId), inArray(projects.tokenHash, [...byHash.keys()]))).orderBy(desc(projects.updatedAt));
  return found.map(({ tokenHash, ...project }) => ({ ...project, token: byHash.get(tokenHash)! }));
}

export async function claimTrialProjects(db: Db, tokens: string[], customerId: string) {
  if (!tokens.length) return 0;
  const saved = await db.update(projects).set({ customerId, updatedAt: new Date() })
    .where(and(isNull(projects.customerId), inArray(projects.tokenHash, tokens.map(hashToken))))
    .returning({ id: projects.id });
  return saved.length;
}

export async function clearTrialProjects() {
  (await cookies()).delete(TRIAL_PROJECTS_COOKIE);
}
