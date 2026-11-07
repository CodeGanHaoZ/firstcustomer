// Read-only reachability and aggregate snapshot. Never prints connection details.
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../../firstcustomer/package.json", import.meta.url));
const { default: postgres } = await import(require.resolve("postgres"));
const snapshot: Record<string, unknown> = { generatedAt: new Date().toISOString(), scope: "Configured environment, read-only aggregate checks; no model tasks" };
try {
  const response = await fetch("http://127.0.0.1:3100/", { signal: AbortSignal.timeout(3000) });
  snapshot.localWeb = { reachable: true, status: response.status };
  await response.body?.cancel();
} catch { snapshot.localWeb = { reachable: false }; }
const connection = process.env.DATABASE_URL;
snapshot.databaseConfigured = Boolean(connection);
function safeError(error: unknown) {
  const err = error as { name?: string; code?: string; message?: string; cause?: { code?: string } };
  const code = err.code ?? err.cause?.code;
  return { name: err.name ?? "Error", code: code && /^[A-Z0-9_]{3,50}$/.test(code) ? code : null,
    category: /connect|ECONN|timeout/i.test(err.message ?? "") ? "connectivity" : /does not exist/i.test(err.message ?? "") ? "missing_relation" : "unclassified" };
}
if (connection) {
  const client = postgres(connection, { max: 1, connect_timeout: 3 });
  try {
    await client`select 1`;
    snapshot.databaseReachable = true;
    const queries = {
      projects: () => client`select product_plan, status, paused, count(*)::int as total from projects group by 1,2,3 order by 1,2,3`,
      queue: () => client`select state, count(*)::int as total from pgboss.job group by state`,
      memberships: () => client`select plan,status,test_account,count(*)::int as total from customer_memberships group by 1,2,3`,
    };
    for (const [key, run] of Object.entries(queries)) {
      try { snapshot[key] = await run(); } catch (error) { snapshot[key] = { available: false, error: safeError(error) }; }
    }
  } catch (error) { snapshot.databaseReachable = false; snapshot.databaseError = safeError(error); }
  finally { await client.end({ timeout: 2 }); }
}
await writeFile(new URL("./runtime.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n");
console.log(JSON.stringify(snapshot, null, 2));
