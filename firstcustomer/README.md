# 首客 HiFirst

按 [PRD V4.2](../首客_FirstCustomer_产品需求规格说明书_V4.2.md) 搭建的比赛版本。首客从免费初诊、报价和到账开始，再做海外定位、英文验证页、获客实验与复盘。老板通过办公室处理待办，客户通过专属链接完成确认。

## 本机运行

不需要 Docker，也不需要 MiMo Key。没有 Key 时用模拟模型，所有内容都会标注为示例。

```bash
npm install
cp .env.example .env.local
```

在 `.env.local` 里填 `ADMIN_PASSWORD`、`SESSION_SECRET`，并打开 `LLM_PROVIDER=stub`、`ALLOW_STUB=1`。然后开三个终端：

```bash
npm run db:dev
```

```bash
npm run db:migrate && npm run worker
```

```bash
npm run dev
```

- 官网：`http://localhost:3100`
- 经营台：`http://localhost:3100/admin`
- 办公室任务板：`http://localhost:3100/admin/tasks`
- 经营周报：`http://localhost:3100/admin/reports`
- 公司卷宗：`http://localhost:3100/admin/context`

拿到 Key 后，在 `.env.local` 填 `MIMO_API_KEY`，去掉两行模拟模型配置，重启 worker。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm test` | 单元测试和流程测试（测试自带数据库） |
| `npm run typecheck` | 类型检查 |
| `npm run db:generate` | 改完 `src/db/schema.ts` 后生成迁移 |
| `npm run seed:evidence -- seeds/evidence.json` | 导入赛前种子证据，格式见 `seeds/evidence.example.json` |

## 代码结构

| 目录 | 内容 |
|---|---|
| `src/domain` | 不依赖外部服务的规则：状态机、两道审批、证据闸门、实验判定 |
| `src/agents` | 四个 Agent 的提示词和输出格式、工具、免费来源、网页读取 |
| `src/ai` | `callModel`（MiMo、备用模型、成本）、`runAgent` 工具循环、模拟模型 |
| `src/workflow` | `engine.ts` 跑 Agent 和打回路由，`actions.ts` 处理人的决定 |
| `src/worker` | 后台进程，从 pg-boss 取任务 |
| `src/app` | 页面：`/` 官网、`/projects/new` 新建、`/p/[token]` 客户项目页、`/admin` 经营台、`/launch/[slug]` 验证页 |

## 操作与数据规则

- **证据工具多一个 `save_evidence`：** 摘录由模型挑选，由程序核对并决定等级，所以检索和保存分成两步。模型仍然不能直接写库。
- **截图不算证据：** 截图由 MiMo 读取后只作为背景交给 Agent。要写进对外页面的产品事实，由老板在“人工补充证据”里登记为“产品事实（客户提供）”。
- **追问只有一次：** Research 整个项目最多追问客户一次、最多 3 个问题。老板可以选择不再等待。
- **客户账号和经营台分开：** 客户用邮箱和密码登录，从「我的项目」打开登录后提交的项目。访客和已有项目仍可使用专属链接。经营者通过 `ADMIN_PASSWORD` 登录。
- **免费初诊：** 公开表单提交后自动开始，完成后可申请 Pro。
- **收款需要人工核对：** 老板在经营台上传收款码。客户接受报价后能扫码并上传截图，票据员提取信息，老板确认实际到账后才进入定位。现有项目沿用原流程，新建自有产品会标明身份并跳过收款。
- **每日站会：** Worker 在北京时间 09:00 生成一次站会。老板可以手动提前生成。工位提醒运行超过 30 分钟的任务和超过 24 小时的老板待办。周报使用生成时的累计经营快照。
- **发布版本：** 修改英文文案或选用产品截图会新建版本。旧版保持可用，直到新版完成声明检查和两道审批后替换。
- **网页读取：** 默认使用 Readability。设置 `READ_PAGE_BROWSER=1` 可在文本不足时启用 Chromium 兜底，Docker Worker 已包含 Chromium。两条路径都检查目标和跳转地址，只允许读取公网。

## 部署

GitHub 仓库 `kongleiwork-art/firstcustomer` 的 `main` 分支已关联 Vercel 项目 `hifirst`，Root Directory 为 `firstcustomer`。每次推送或合并到 `main`，Vercel 会自动构建，成功后更新正式站点 https://hifirst.vercel.app；构建失败时保留当前线上版本。日常发布直接推送 `main` 即可，不需要再手动执行 `vercel --prod`。

Vercel 从本目录部署 Next.js，Neon 提供 PostgreSQL。先对线上数据库运行 `npm run db:migrate`，再部署。生产环境设置 `DATABASE_URL`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`BETTER_AUTH_SECRET`、`MIMO_API_KEY` 和 `CRON_SECRET`。Neon 同时提供 `DATABASE_URL_UNPOOLED` 时，任务队列会使用它。在 Vercel 设置 `NODE_OPTIONS=--experimental-require-module`，让研究任务中的网页解析依赖能正常加载。Vercel Queues 触发数据库中已提交的任务，每日站会由 `vercel.json` 中的定时任务触发。线上每次上传的文件合计不得超过 4 MB。

也可以使用 Docker Compose 部署：

一台能运行 Docker 的香港或新加坡 VPS，域名解析到这台机器：

```bash
cp .env.example .env
```

填好 `.env` 里的 `ADMIN_PASSWORD`、`SESSION_SECRET`、`MIMO_API_KEY`、`DOMAIN`、`POSTGRES_PASSWORD`，然后：

```bash
docker compose up -d --build
docker compose ps --all
```

先确认 `postgres` 健康、`migrate` 以 0 退出，`web`、`worker` 和 `caddy` 都在运行。Worker 只运行一个，任务逐个执行。上线后用国内手机网络和美国节点各打开一次已发布的验证页。

Linux 隔离环境已验证 Compose 启动、迁移、Caddy HTTPS 和从建单到客户验收的浏览器流程。该环境使用独立数据库、测试订单和本地证书。真实 MiMo 的全流程另在独立数据库验证。

## 公网交付前

- 确认部署域名与主机，在国内手机网络和美国节点验证公开页。
- 由外部客户接受报价、完成付款并授权展示，由老板核对到账。公开验证页要收到真实有效的线索。
