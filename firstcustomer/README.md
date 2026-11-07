# 首客 HiFirst

本目录是首客的 Next.js 应用。项目介绍、线上体验与首页截图见 [仓库 README](../README.md)，需求背景见 [PRD V4.2](../首客_FirstCustomer_产品需求规格说明书_V4.2.md)。本文记录本地开发、配置和部署步骤，以下命令均在本目录执行。

## 本机运行

需要 Node.js 22.12 或以上版本及 npm。使用嵌入式 PostgreSQL 时不需要 Docker；没有 MiMo Key 时可用模拟模型体验项目工作流，输出会标注为示例。

```bash
npm ci
cp .env.example .env.local
```

在 `.env.local` 里填 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 和至少 32 字符的 `SESSION_SECRET`，后者可用 `openssl rand -base64 32` 生成。启用 `LLM_PROVIDER=stub`、`ALLOW_STUB=1`，然后按顺序开三个终端：

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
- 客户注册：`http://localhost:3100/register`
- 客户登录：`http://localhost:3100/login`
- 我的项目：`http://localhost:3100/account`
- 提交项目：`http://localhost:3100/projects/new`
- 经营台：`http://localhost:3100/admin`
- 办公室任务板：`http://localhost:3100/admin/tasks`
- 经营周报：`http://localhost:3100/admin/reports`
- 公司卷宗：`http://localhost:3100/admin/context`
- 资料库：`http://localhost:3100/admin/knowledge`

模拟模式下 Lumi 的自由对话不可用，项目工作流仍可使用示例模型。开发数据库持久化在 `.local-pg/`，仅监听本机端口 `54329`。

## 中英文界面

首页、登录注册、项目登记、客户项目工作台和内部经营台共用右上角或侧栏的「中文 / EN」开关。语言偏好保存于 `fc_locale` Cookie，刷新和站内跳转会保留。界面标签、状态、提示和预览工具栏支持英文；客户填写内容、已生成报告、资料库正文及证据原文保留原文。表单选项只切换显示文本，提交值与已有数据保持兼容。

新增界面文案时，在 `src/lib/ui-messages.ts` 添加对应英文，并用 `T` 包住界面标签；输入框和链接的提示属性使用 `localized-controls`，避免客户端与服务端首屏属性不一致。

## 模型配置

默认通过服务器直连 MiMo，当前默认模型为 `mimo-v2.6-pro` 和 `mimo-v2.6-flash`。在 `.env.local` 填写 `MIMO_API_KEY`，移除 `LLM_PROVIDER=stub` 和 `ALLOW_STUB=1`，重启网站与 Worker 即可启用真实调用。

| 变量 | 用途 |
| --- | --- |
| `MIMO_API_KEY` | MiMo API 密钥，网站前台与后台任务共用 |
| `MIMO_MODEL_PRO` / `MIMO_MODEL_FLASH` | 可选，覆盖默认模型 |
| `MIMO_BASE_URL` | 可选，覆盖 MiMo 接口地址 |
| `MIMO_WEB_SEARCH` | 默认 `0`，设为 `1` 时启用 MiMo 联网搜索并产生对应调用费用 |
| `MODEL_COST_SPONSORED` | 赛事赞助模型费用时设为 `1`，经营台保留标价并注明赞助 |
| `FALLBACK_PROVIDER` / `FALLBACK_BASE_URL` / `FALLBACK_API_KEY` / `FALLBACK_MODEL` | 可选，主模型故障时使用兼容 OpenAI 接口的备用模型 |

首页和创建项目页的 Lumi 共用 `/api/lumi/intake`，支持真实 AI 多轮问答、流式回复、动态选项和需求草稿；原 `/api/lumi` 保留为通用问答接口。项目研究与交付走后台任务。API Key 仅供服务器读取，不需要发给客户，也不应使用 `NEXT_PUBLIC_` 前缀。`.env.local`、`.env` 和 `.vercel/` 均不提交到 Git。

## 客户账号

客户通过 Better Auth 使用邮箱与密码注册、登录，密码至少 10 个字符。不登录也可以从 `/account` 进入「试用工作台」并创建项目，当前浏览器保存最近 12 个试用项目入口 30 天。注册或登录后，本浏览器持有有效凭据的试用项目归入账号；登录后提交的项目绑定当前账号。原有专属链接仍可使用。

`BETTER_AUTH_SECRET` 可单独配置，未设置时沿用 `SESSION_SECRET`。固定使用自定义域名时，可通过 `BETTER_AUTH_URL` 指定完整的 HTTPS 地址。客户账号与经营台权限独立，经营者使用独立的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录 `/admin/login`，所有环境均要求登录。修改内部账号或密码后旧会话失效。目前未接入邮件验证、找回密码和第三方登录。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm test` | 单元测试和流程测试（测试自带数据库） |
| `npm run typecheck` | 类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm run build` | 生成 Next.js 生产构建 |
| `npm run db:migrate` | 对 `DATABASE_URL` 指向的数据库执行已生成的迁移 |
| `npm run knowledge:seed` | 载入 14 篇首客基础资料，重复执行不覆盖已有内容 |
| `npm run db:generate` | 改完 `src/db/schema.ts` 后生成迁移 |
| `npm run seed:evidence -- seeds/evidence.json` | 导入赛前种子证据，格式见 `seeds/evidence.example.json` |

## 代码结构

| 目录 | 内容 |
|---|---|
| `src/domain` | 不依赖外部服务的规则：状态机、两道审批、证据闸门、实验判定 |
| `src/agents` | 各 Agent 的提示词、输出格式、工具、免费来源与网页读取 |
| `src/ai` | `callModel`（MiMo、备用模型、成本）、`runAgent` 工具循环、模拟模型 |
| `src/workflow` | `engine.ts` 跑 Agent 和打回路由，`actions.ts` 处理人的决定 |
| `src/worker` | 后台进程，从 pg-boss 取任务 |
| `src/jobs` | 任务入队、云端唤醒与本机/云端共用的执行器 |
| `src/lib` | 身份验证、项目访问、上传校验与品牌配置 |
| `src/components` | Lumi 动态接待、AI 对话、办公室与客户/经营台组件 |
| `src/app` | 官网、注册登录、客户项目、经营台、英文验证页与 API |
| `drizzle` | PostgreSQL 表结构迁移，包含客户账号与项目归属 |
| `public/brand` | 兔子静态形象、8 秒静音循环视频及首帧封面 |
| `src/knowledge` | 共享资料的验证、发布快照、版本历史、按角色检索和初始内容 |

## 共享资料库

迁移后运行 `npm run knowledge:seed`，即可在经营台「资料库」维护初始资料；也可以通过页面「补齐基础资料」初始化。编辑稿与发布快照分开保存，Agent 只读取已发布、未过期且授权给自己的内容。Lumi 额外限制为公开资料。

Research、Strategy、Launch、Growth、接待报价员、项目客服、COO 和经营秘书会读取各自资料，并在任务或报告输入中保留使用的版本。票据员与截图阅读员继续按固定规则识别图片。资料库不会自动汇入其他客户的项目记录。

页面支持搜索筛选、Markdown/TXT 导入、撤下、发布历史、ZIP 导出与无模型调用的检索预览。操作方式见[资料库使用说明](../docs/knowledge.md)。

## 操作与数据规则

- **证据工具多一个 `save_evidence`：** 摘录由模型挑选，由程序核对并决定等级，所以检索和保存分成两步。模型仍然不能直接写库。
- **截图不算证据：** 截图由 MiMo 读取后只作为背景交给 Agent。要写进对外页面的产品事实，由老板在“人工补充证据”里登记为“产品事实（客户提供）”。
- **追问只有一次：** Research 整个项目最多追问客户一次、最多 3 个问题。老板可以选择不再等待。
- **客户账号和经营台分开：** 客户可免登录试用，登录或注册用于归档项目与跨设备访问。经营者通过独立的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录。
- **免费出海机会分析：** `/projects/new` 由 Lumi 根据描述动态追问，一次提取多项信息，支持流式回复、动态选项、对话修订和截图理解。需求草稿随对话更新，核心信息齐备后由客户确认创建，再自动分析出海机会，完成后可申请 Pro。首页兔子对话与项目页共享草稿；兼容旧表单草稿，对话和文本保存在当前浏览器，截图只保留在本次页面会话中。未确认前不创建项目。内部建项仍使用完整表单。
- **收款需要人工核对：** 老板在经营台上传收款码。客户接受报价后能扫码并上传截图，票据员提取信息，老板确认实际到账后才进入定位。现有项目沿用原流程，新建自有产品会标明身份并跳过收款。
- **每日站会：** Worker 在北京时间 09:00 生成一次站会。老板可以手动提前生成。工位提醒运行超过 30 分钟的任务和超过 24 小时的老板待办。周报使用生成时的累计经营快照。
- **发布版本：** 修改英文文案或选用产品截图会新建版本。旧版保持可用，直到新版完成声明检查和两道审批后替换。
- **网页读取：** 默认使用 Readability。设置 `READ_PAGE_BROWSER=1` 可在文本不足时启用 Chromium 兜底，Docker Worker 已包含 Chromium。两条路径都检查目标和跳转地址，只允许读取公网。

## 部署

### Vercel + Neon

GitHub 仓库 `kongleiwork-art/firstcustomer` 的 `main` 分支已关联 Vercel 项目 `hifirst`，Root Directory 为 `firstcustomer`。每次推送或合并到 `main`，Vercel 会自动构建，成功后更新[正式站点](https://hifirst.vercel.app/)；构建失败时保留当前线上版本。日常代码发布直接推送 `main` 即可。

Vercel 部署 Next.js，Neon 提供 PostgreSQL。首次部署及表结构变更时，使用指向目标数据库的 `DATABASE_URL` 独立执行 `npm run db:migrate`，再发布代码；构建过程不会自动执行迁移。

在 Vercel 项目的生产环境配置：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL 连接地址 |
| `DATABASE_URL_UNPOOLED` | 可选，Neon 直连地址；配置后 pg-boss 优先使用它 |
| `ADMIN_USERNAME` | 经营台账号，默认 `hifirst` |
| `ADMIN_PASSWORD` | 经营台密码 |
| `SESSION_SECRET` | 至少 32 字符的会话密钥 |
| `BETTER_AUTH_SECRET` | 客户认证密钥；未设置时沿用 `SESSION_SECRET` |
| `MIMO_API_KEY` | MiMo API 密钥 |
| `CRON_SECRET` | 每日站会接口的鉴权密钥 |
| `NODE_OPTIONS` | `--experimental-require-module`，供研究任务中的网页解析依赖加载 |
| `BETTER_AUTH_URL` | 可选，自定义域名使用的完整 HTTPS 地址 |
| `PRIVACY_CONTACT` | 可选，英文验证页隐私说明中的联系信息 |

生产环境移除本机的模拟模型配置。环境变量修改后需重新部署。

云端任务先保存到 PostgreSQL，再由 Vercel Queues 的 `hifirst-work` 主题唤起 `/api/jobs/work` 执行。`vercel.json` 将函数部署到 `sin1`，并在每天 UTC 01:00（北京时间 09:00）调用 `/api/jobs/daily`，唤醒等待任务并生成站会。该部署不需要额外运行本机的常驻 Worker。

线上每次上传的文件合计不得超过 4 MB。Lumi 的动画会静音循环，可手动暂停；离开视口、页面隐藏或打开聊天时暂停，系统开启减少动态效果时保留静态封面。

### Docker Compose

一台能运行 Docker 的香港或新加坡 VPS，域名解析到这台机器：

```bash
cp .env.example .env
```

填好 `.env` 里的 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`MIMO_API_KEY`、`DOMAIN`、`POSTGRES_PASSWORD`，然后：

```bash
docker compose up -d --build
docker compose ps --all
```

先确认 `postgres` 健康、`migrate` 以 0 退出，`web`、`worker` 和 `caddy` 都在运行。Worker 只运行一个，任务逐个执行。上线后用国内手机网络和美国节点各打开一次已发布的验证页。

Linux 隔离环境已验证 Compose 启动、迁移、Caddy HTTPS 和从建单到客户验收的浏览器流程。该环境使用独立数据库、测试订单和本地证书。真实 MiMo 的全流程另在独立数据库验证。

## 公网交付前

- 确认部署域名与主机，在国内手机网络和美国节点验证公开页。
- 由外部客户接受报价、完成付款并授权展示，由老板核对到账。公开验证页要收到真实有效的线索。
