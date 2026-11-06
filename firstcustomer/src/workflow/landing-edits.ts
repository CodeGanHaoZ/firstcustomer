import { and, desc, eq, ne } from "drizzle-orm";
import type { PageContent } from "@/agents/schemas";
import type { Db } from "@/db";
import { campaigns, claims, companySettings, decisions, evidenceItems, landingPageImages, landingPages, projectImages, projects } from "@/db/schema";
import type { Verdict } from "@/domain/approval";
import { checkClaims, checkForbiddenTerms, type Asset, type ClaimInput } from "@/domain/claims";
import { transition } from "./transitions";

export async function recordClaimCheck(db: Db, input: {
  projectId: string; version: number; subjectId?: string; verdict: Verdict; reason: string;
}) {
  await db.insert(decisions).values({
    projectId: input.projectId, gate: "claim_check", subjectVersion: input.version, subjectId: input.subjectId,
    actorRole: "system", verdict: input.verdict, reason: input.reason,
  });
}

export async function editLandingPage(db: Db, input: {
  projectId: string;
  version: number;
  content: PageContent;
  image: string;
  claim: ClaimInput | null;
}) {
  const rejection = await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).for("update");
    if (!project || !["awaiting_publish", "collecting"].includes(project.status)) throw new Error("项目当前无法修改验证页");
    const [latest] = await tx.select().from(landingPages).where(eq(landingPages.projectId, project.id))
      .orderBy(desc(landingPages.version)).limit(1);
    if (!latest || latest.version !== input.version || latest.positioningVersion !== project.positioningVersion ||
      !["checked", "published"].includes(latest.status)) throw new Error("页面版本已更新，请刷新后编辑");
    const [[campaign], oldClaims, evidence, [settings]] = await Promise.all([
      tx.select().from(campaigns).where(eq(campaigns.landingPageId, latest.id)),
      tx.select().from(claims).where(eq(claims.landingPageId, latest.id)),
      tx.select().from(evidenceItems).where(eq(evidenceItems.projectId, project.id)),
      tx.select({ terms: companySettings.forbiddenTerms }).from(companySettings).where(eq(companySettings.id, 1)),
    ]);
    if (!campaign) throw new Error("没有可继承的渠道方案");
    const bindings: ClaimInput[] = oldClaims.map((claim) => ({
      text: claim.text, kind: claim.kind as ClaimInput["kind"],
      location: claim.location as ClaimInput["location"], evidence_id: claim.evidenceId,
    }));
    if (input.claim) bindings.push(input.claim);
    const assets = campaign.assets as Asset[];
    const errors = [
      ...checkClaims({ projectId: project.id, page: input.content, claims: bindings, assets, evidence, now: new Date() }),
      ...checkForbiddenTerms(input.content, [...assets, ...bindings.map((item) => ({ title: "", body: item.text }))], settings?.terms ?? []),
    ];
    const version = latest.version + 1;
    if (errors.length) {
      const reason = errors.map(({ target, message }) => `${target}：${message}`).join("；");
      await recordClaimCheck(tx, { projectId: project.id, version, verdict: "reject", reason });
      return reason;
    }

    const [image] = input.image === "none" ? [] : input.image === "keep"
      ? await tx.select({ mimeType: landingPageImages.mimeType, data: landingPageImages.data }).from(landingPageImages)
        .where(eq(landingPageImages.landingPageId, latest.id))
      : await tx.select({ mimeType: projectImages.mimeType, data: projectImages.data }).from(projectImages)
        .where(and(eq(projectImages.id, input.image), eq(projectImages.projectId, project.id), eq(projectImages.kind, "product")));
    if (!image && !["none", "keep"].includes(input.image)) throw new Error("没有找到所选的产品截图");

    const slug = `${latest.slug.replace(/-rev-\d+$/, "")}-rev-${version}`;
    const [saved] = await tx.insert(landingPages).values({
      projectId: project.id, version, slug, positioningVersion: project.positioningVersion,
      content: input.content, status: "checked",
    }).returning({ id: landingPages.id });
    if (latest.status === "checked") await tx.update(landingPages).set({ status: "superseded" }).where(eq(landingPages.id, latest.id));
    if (image) await tx.insert(landingPageImages).values({ landingPageId: saved.id, ...image });
    if (bindings.length) await tx.insert(claims).values(bindings.map((claim) => ({
      landingPageId: saved.id, text: claim.text, kind: claim.kind, location: claim.location,
      evidenceId: claim.evidence_id, checkPassed: true,
    })));
    await tx.insert(campaigns).values({
      projectId: project.id, landingPageId: saved.id, channel: campaign.channel, reason: campaign.reason,
      checklist: campaign.checklist, assets: campaign.assets,
    });
    await recordClaimCheck(tx, { projectId: project.id, version, subjectId: saved.id, verdict: "approve", reason: "修改后的文案与声明通过检查" });
    await transition(tx, project, "awaiting_publish", "founder", `编辑验证页第 ${version} 版，已通过声明检查，等待重新审批`);
    return null;
  });
  if (rejection) throw new Error(rejection);
}

export function parseLandingVersion(raw: string | string[] | undefined) {
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  if (!values.length) return undefined;
  if (values.length !== 1 || !/^[1-9]\d{0,9}$/.test(values[0]) || Number(values[0]) > 2_147_483_647) return null;
  return Number(values[0]);
}

export async function loadLandingVersion(db: Db, projectId: string, version?: number) {
  const [page] = await db.select().from(landingPages)
    .where(and(eq(landingPages.projectId, projectId), ne(landingPages.status, "superseded"),
      version === undefined ? undefined : eq(landingPages.version, version)))
    .orderBy(desc(landingPages.version)).limit(1);
  return page ?? null;
}

export async function loadVersionImage(db: Db, projectId: string, version?: number) {
  const page = await loadLandingVersion(db, projectId, version);
  if (!page) return null;
  const [image] = await db.select().from(landingPageImages).where(eq(landingPageImages.landingPageId, page.id));
  return image ?? null;
}

export async function loadPublicVersionImage(db: Db, slug: string) {
  const [image] = await db.select({ mimeType: landingPageImages.mimeType, data: landingPageImages.data })
    .from(landingPageImages).innerJoin(landingPages, eq(landingPages.id, landingPageImages.landingPageId))
    .where(and(eq(landingPages.slug, slug), eq(landingPages.status, "published")));
  return image ?? null;
}

export async function hasVersionImage(db: Db, landingPageId: string) {
  const [row] = await db.select({ id: landingPageImages.landingPageId }).from(landingPageImages)
    .where(eq(landingPageImages.landingPageId, landingPageId));
  return !!row;
}
