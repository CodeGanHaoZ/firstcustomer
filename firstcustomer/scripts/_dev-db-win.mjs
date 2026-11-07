// 本地 Windows 环境补丁：中文 locale(936) 会让 initdb 失败，显式指定 C locale + UTF8
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
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
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
