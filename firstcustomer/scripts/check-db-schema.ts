import { createDb } from "../src/db";
import { databaseMigrationStatus } from "../src/db/migrations";

if (process.env.VERCEL_ENV !== "production" && !process.argv.includes("--production")) {
  console.log("非生产构建，跳过线上数据库迁移检查。");
} else {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("缺少数据库连接，无法检查生产数据库迁移。");
  const { db, sql } = createDb(url);
  try {
    const status = await databaseMigrationStatus(db);
    if (!status.ready) throw new Error(`生产数据库与源码迁移不一致（待执行 ${status.pending} 项）。请对目标数据库执行 npm run db:migrate 后重新部署。`);
    console.log("生产数据库迁移检查通过。");
  } finally { await sql.end(); }
}
