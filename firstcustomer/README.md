# 首客 FirstCustomer

按 [PRD V1.1](../首客_FirstCustomer_产品需求规格说明书_V1.1.md) 搭建的比赛版本：MiMo Agent 研究市场、制定定位、生成英文验证页、复盘真实数据，老板把关、客户确认。

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

## 和 PRD 的差异

- **证据工具多一个 `save_evidence`：** 摘录由模型挑选，由程序核对并决定等级，所以检索和保存分成两步。模型仍然不能直接写库。
- **截图不算证据：** 截图由 MiMo 读取后只作为背景交给 Agent。要写进对外页面的产品事实，由老板在“人工补充证据”里登记为“产品事实（客户提供）”。
- **追问只有一次：** Research 整个项目最多追问客户一次、最多 3 个问题。老板可以选择不再等待。
- **没有 `users` 表：** 比赛版只有一位经营者，用 `ADMIN_PASSWORD` 登录；客户用项目专属链接。
- **额外的表：** `state_transitions`、`positionings`、`source_documents`、`evidence_searches`、`leads`，用来保存状态记录、定位版本、来源原文、反向检索记录和留资。
- **新项目不会自动开始：** 公开表单提交后要老板点“开始研究”，防止陌生人消耗模型额度。
- **收款是人工记录：** 还没有接支付渠道。

## 部署

一台能运行 Docker 的香港或新加坡 VPS，域名解析到这台机器：

```bash
cp .env.example .env
```

填好 `.env` 里的 `ADMIN_PASSWORD`、`SESSION_SECRET`、`MIMO_API_KEY`、`DOMAIN`、`POSTGRES_PASSWORD`，然后：

```bash
docker compose up -d --build
```

Worker 只运行一个，任务逐个执行。上线后用国内手机网络和美国节点各打开一次验证页。

## 还没验证

- **MiMo：** 只用无效 Key 确认过接口地址和 SDK 能通（返回 401）。真实生成、工具调用格式、图片理解、联网搜索都要有 Key 才能测。图片按官方文档的 Base64 格式传入。
- **部署：** 本机没有 Docker，Dockerfile、Compose 和 Caddy 配置没有实际运行过。
- **网页读取：** Playwright 兜底没有运行过。HN、GitHub Issues、Stack Exchange、dev.to、iTunes、npm、Wayback 和 Readability 读取在 2026-11-05 手动试过，可用，但自动测试里没有联网，运行中可能受频率限制。
