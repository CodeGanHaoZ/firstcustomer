// Deliberately constructed counterexamples, not measurements on customer data.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkClaims } from "../../../firstcustomer/src/domain/claims";
import { verifyQuote } from "../../../firstcustomer/src/domain/evidence";
import { unsupportedFigures } from "../../../firstcustomer/src/domain/experiment";

const source = "I complain about meeting notes but I would never pay for another notes app.";
const excerpt = "I would never pay for another notes app";
const match = verifyQuote(excerpt, source);
const claim = "Customers are willing to pay for our notes app";
const violations = checkClaims({ projectId: "probe-project", now: new Date("2026-11-08T00:00:00Z"),
  page: { headline: "Meeting notes", subheadline: "For teams", value_props: ["Clear notes"], scenarios: ["Team calls"], cta_label: "Try", form_prompt: "Your email" },
  claims: [{ text: claim, kind: "pain", evidence_id: "probe-evidence", location: "page" }], assets: [],
  evidence: [{ id: "probe-evidence", projectId: "probe-project", status: match.status, licenseStatus: "public_reference", expiresAt: new Date("2026-12-01T00:00:00Z") }],
});
const target = "Our product increased revenue by 19%.";
const numberSource = "A competitor charges $19 per seat per month.";
const unsupported = unsupportedFigures(target, [numberSource]);
const result = { executedAt: new Date().toISOString(), dataType: "constructed_counterexamples", liveModelUsed: false,
  probes: [
    { id: "P01", dimension: "Toulmin / concept distinction", source, excerpt, claim,
      expected: "Reject a claim contradicted by its source", actual: { quoteStatus: match.status, violations },
      result: violations.length ? "passed" : "failed", interpretation: "Structural claim checks do not validate semantic support. Human review is separate and was not performed in this probe." },
    { id: "P02", dimension: "Data consistency", source: numberSource, claim: target,
      expected: "Reject a percentage inferred from another product's price", actual: { unsupported },
      result: unsupported.length ? "passed" : "failed", interpretation: "Numeric matching does not bind values to units, subjects and measurement periods." },
  ] };
writeFileSync(fileURLToPath(new URL("./probes.json", import.meta.url)), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
