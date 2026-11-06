export type ClaimKind = "metric" | "comparison" | "pain" | "feature";

export type ClaimInput = {
  text: string;
  kind: ClaimKind;
  evidence_id: string | null;
  location: "page" | "asset";
};

export type ClaimEvidence = {
  id: string;
  projectId: string | null;
  status: string;
  licenseStatus: string;
  expiresAt: Date;
};

export type PageSlots = {
  headline: string;
  subheadline: string;
  value_props: string[];
  scenarios: string[];
  cta_label: string;
  form_prompt: string;
};

export type Asset = { title: string; body: string };

export type ClaimViolation = { target: string; message: string };

const DIGITS = /[\p{Nd}%％]/u;
const USABLE_LICENSES = ["public_reference", "customer_authorized", "permitted"];

export function checkForbiddenTerms(page: PageSlots, assets: Asset[], terms: string[]): ClaimViolation[] {
  const copy = [...Object.values(page).flat(), ...assets.flatMap((asset) => [asset.title, asset.body])];
  return terms.flatMap((term) => copy.some((item) => item.toLowerCase().includes(term.toLowerCase()))
    ? [{ target: term, message: "包含公司卷宗登记的禁用词" }] : []);
}

// 第二道证据闸门：页面和素材送审前由程序检查，不依赖模型判断。
export function checkClaims(input: {
  projectId: string;
  page: PageSlots;
  claims: ClaimInput[];
  assets: Asset[];
  evidence: ClaimEvidence[];
  now: Date;
}): ClaimViolation[] {
  const violations: ClaimViolation[] = [];
  const byId = new Map(input.evidence.map((e) => [e.id, e]));

  for (const claim of input.claims) {
    if (!claim.evidence_id) {
      violations.push({ target: claim.text, message: "事实声明没有绑定证据" });
      continue;
    }
    const evidence = byId.get(claim.evidence_id);
    if (!evidence) {
      violations.push({ target: claim.text, message: "绑定的证据不存在" });
    } else if (evidence.projectId && evidence.projectId !== input.projectId) {
      violations.push({ target: claim.text, message: "本项目无权使用这条证据" });
    } else if (evidence.status !== "verified") {
      violations.push({ target: claim.text, message: "绑定的证据尚未通过核对" });
    } else if (!USABLE_LICENSES.includes(evidence.licenseStatus)) {
      violations.push({ target: claim.text, message: "证据的许可状态不允许对外使用" });
    } else if (evidence.expiresAt < input.now) {
      violations.push({ target: claim.text, message: "证据已过期，需要重新核对" });
    }
  }

  const slots: [string, string][] = [
    ["标题", input.page.headline],
    ["副标题", input.page.subheadline],
    ["行动按钮", input.page.cta_label],
    ["表单提示", input.page.form_prompt],
    ...input.page.value_props.map((v): [string, string] => ["价值点", v]),
    ...input.page.scenarios.map((v): [string, string] => ["使用场景", v]),
  ];
  for (const [name, text] of slots) {
    if (DIGITS.test(text)) {
      violations.push({
        target: text,
        message: `${name}里出现了数字，数字只能写在已登记的声明里`,
      });
    }
  }

  const assetClaims = input.claims.filter((c) => c.location === "asset");
  for (const asset of input.assets) {
    const remainder = assetClaims.reduce(
      (body, claim) => body.split(claim.text).join(""),
      asset.body,
    );
    if (DIGITS.test(remainder)) {
      violations.push({
        target: asset.title,
        message: "素材正文里有未登记的数字",
      });
    }
  }
  return violations;
}
