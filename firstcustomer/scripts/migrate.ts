import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("缺少 DATABASE_URL");

const { db, sql } = createDb(url);
await migrate(db, { migrationsFolder: "./drizzle" });
await sql.end();
console.log("数据库迁移完成");
