import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let client: postgres.Sql | undefined;
let instance: Db | undefined;

export function createDb(url: string) {
  const sql = postgres(url, { max: 10 });
  return { db: drizzle(sql, { schema }), sql };
}

// 构建时没有 DATABASE_URL，所以连接要等到第一次使用时才创建。
export function getDb(): Db {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("缺少 DATABASE_URL");
  const created = createDb(url);
  client = created.sql;
  instance = created.db;
  return instance;
}

export async function closeDb() {
  await client?.end();
  client = undefined;
  instance = undefined;
}

export { schema };
