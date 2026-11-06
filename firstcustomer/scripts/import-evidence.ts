// 批量导入赛前手工整理的种子证据：npm run seed:evidence -- seeds/evidence.json
import { readFileSync } from "node:fs";
import { z } from "zod";
import { readPage } from "../src/agents/fetch-page";
import { closeDb, getDb } from "../src/db";
import { addManualEvidence } from "../src/workflow/actions";

const row = z.object({
  url: z.url(),
  quote: z.string().min(12),
  source_text: z.string().optional(),
  kind: z.enum(["pain", "pricing", "revenue", "signal", "channel", "product"]),
  stance: z.enum(["support", "against", "neutral"]).default("support"),
  product: z.string().optional(),
  category: z.string().optional(),
  number: z.string().optional(),
  metric: z.string().optional(),
  collected_at: z.iso.date().optional(),
});

const path = process.argv[2];
if (!path) throw new Error("用法：npm run seed:evidence -- seeds/evidence.json");

const rows = z.array(row).parse(JSON.parse(readFileSync(path, "utf8")));
const db = getDb();
let verified = 0;
let review = 0;
const failed: string[] = [];

for (const item of rows) {
  try {
    const sourceText = item.source_text ?? (await readPage(item.url)).text;
    const saved = await addManualEvidence(db, {
      url: item.url,
      quote: item.quote,
      sourceText,
      kind: item.kind,
      stance: item.stance,
      product: item.product,
      category: item.category,
      numberValue: item.number,
      metric: item.metric,
      createdBy: "seed",
      collectedAt: item.collected_at ? new Date(item.collected_at) : undefined,
    });
    if (saved.status === "verified") verified++;
    else review++;
  } catch (error) {
    failed.push(`${item.url}：${error instanceof Error ? error.message : error}`);
  }
}

console.log(`已验证 ${verified} 条，待人工核对 ${review} 条，失败 ${failed.length} 条`);
for (const line of failed) console.log(`- ${line}`);
await closeDb();
