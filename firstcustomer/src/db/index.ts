import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const processCache = globalThis as typeof globalThis & { hifirstPostgres?: postgres.Sql };
let instance: Db | undefined;

export function createDb(url: string) {
  const sql = postgres(url, process.env.VERCEL === "1"
    ? { max: 3, idle_timeout: 20, prepare: false }
    : { max: 10 });
  return { db: drizzle(sql, { schema }), sql };
}

// 构建时没有 DATABASE_URL，所以连接要等到第一次使用时才创建。
export function getDb(): Db {
  if (instance) return instance;
  if (!processCache.hifirstPostgres) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("缺少 DATABASE_URL");
    const { db, sql } = createDb(url);
    processCache.hifirstPostgres = sql;
    instance = db;
  } else {
    instance = drizzle(processCache.hifirstPostgres, { schema });
  }
  return instance;
}

export async function closeDb() {
  await processCache.hifirstPostgres?.end();
  processCache.hifirstPostgres = undefined;
  instance = undefined;
}

export { schema };
