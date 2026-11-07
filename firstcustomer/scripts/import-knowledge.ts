import { readFile } from "node:fs/promises";
import { closeDb, getDb } from "../src/db";
import { importKnowledgeBundle, knowledgeBundleSchema } from "../src/knowledge/import";

const [file, mode] = process.argv.slice(2);
if (!file || !["--dry-run", "--draft", "--publish"].includes(mode) || process.argv.length !== 4) {
  throw new Error("用法：npm run knowledge:import -- <导入包.json> <--dry-run|--draft|--publish>");
}
const bundle = knowledgeBundleSchema.parse(JSON.parse(await readFile(file, "utf8")));
if (mode === "--dry-run") {
  console.log(JSON.stringify({ bundleId: bundle.bundleId, articles: bundle.articles.map(({ key, content }) => ({
    key, title: content.title, visibility: content.visibility, agents: content.agents, characters: content.content.length,
  })) }, null, 2));
} else {
  try {
    const result = await importKnowledgeBundle(getDb(), bundle, mode === "--publish");
    console.log(JSON.stringify({ ...result, mode }, null, 2));
  } finally { await closeDb(); }
}
