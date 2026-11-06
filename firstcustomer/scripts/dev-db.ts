// 本机没有 Docker 时用的开发数据库，数据放在 .local-pg，只监听本机端口。
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = ".local-pg";
const firstRun = !existsSync(`${databaseDir}/PG_VERSION`);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "firstcustomer",
  password: "firstcustomer",
  port: 54329,
  persistent: true,
  autoRehydrateSymlinks: true,
  onLog: () => {},
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase("firstcustomer");

console.log(
  "开发数据库已启动：postgres://firstcustomer:firstcustomer@127.0.0.1:54329/firstcustomer",
);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
