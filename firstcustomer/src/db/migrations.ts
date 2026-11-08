import { readMigrationFiles } from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";
import type { Db } from "./index";

// Read-only release gate: never apply DDL or silently hide a missing migration.
export async function databaseMigrationStatus(db: Db, migrationsFolder = "./drizzle") {
  const migrations = readMigrationFiles({ migrationsFolder });
  const [journal] = await db.execute<{ present: boolean }>(sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`);
  const [latest] = journal.present
    ? await db.execute<{ hash: string; created_at: string }>(sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`)
    : [];
  const appliedAt = Number(latest?.created_at ?? 0);
  const pending = migrations.filter((migration) => migration.folderMillis > appliedAt);
  const expected = migrations.find((migration) => migration.folderMillis === appliedAt);
  const versionMatches = !latest || Boolean(expected && expected.hash === latest.hash);
  return { ready: pending.length === 0 && versionMatches, pending: pending.length, appliedAt, versionMatches };
}
