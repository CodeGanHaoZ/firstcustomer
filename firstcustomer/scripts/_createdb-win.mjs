// 本机补丁：embedded-postgres 精简构建不含 createdb，用 pg 客户端建库
import pg from "pg";

const c = new pg.Client({
  host: "127.0.0.1",
  port: 54329,
  user: "firstcustomer",
  password: "firstcustomer",
  database: "postgres",
});
await c.connect();
const r = await c.query("select 1 from pg_database where datname='firstcustomer'");
if (r.rowCount === 0) {
  await c.query("create database firstcustomer");
  console.log("已创建数据库 firstcustomer");
} else {
  console.log("数据库 firstcustomer 已存在");
}
await c.end();
