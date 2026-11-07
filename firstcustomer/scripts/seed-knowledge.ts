import { closeDb, getDb } from "../src/db";
import { seedKnowledge } from "../src/knowledge/seed";

try {
  const added = await seedKnowledge(getDb());
  console.log(`资料库已就绪，新增 ${added} 篇基础资料；已有资料保持原样。`);
} finally {
  await closeDb();
}
