# 首客 HiFirst

本目录是首客的 Next.js 应用。项目介绍、线上体验与首页截图见 [仓库 README](../README.md)，需求背景见 [PRD V4.2](../首客_FirstCustomer_产品需求规格说明书_V4.2.md)。本文记录本地开发、配置和部署步骤，以下命令均在本目录执行。

老板登录后进入 `/admin/owner`，集中处理批价、核款与审批；`/admin/audit` 可查看全公司的决策与操作记录。九道闸门对应、数据口径和本次后端检查见 [OPC 老板经营台说明](../docs/owner-console.md)。

`/admin/access` 展示当前老板账号与 11 项服务端权限。供给方（服务商／开发者）与需求方（委托客户）的角色、委托流转和交互规格见 [双边协作设计](../docs/two-sided-workflow-design.md)；双边委托模块仍处于设计阶段。

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

## 办公室引导与动效

首页六幕协作演示展示当前任务、交付物、下一位 Agent 与需要人工确认的条件。动物会处理任务、携带文件、当面核对、交接并回到工位开工；工位标题持续可见，可直接点击「处理任务 / 当面交接 / 接手开工」查看任一阶段。手机可以横向查看放大的办公室，镜头跟随当前协作，也可以手动查看或恢复跟随。六位角色介绍保持两列三行。

客户项目页与经营台共用 `src/domain/office-guide.ts` 的状态说明：根据运行任务、套餐、报价、凭证与审批记录展示「现在 / 接下来 / 你需要做什么」。排队与等待确认不会伪装成工作中。工作角色有明显的尺寸、动作、工具与标题；点击客户工位可查看职责。动画不提交业务操作、不确认付款或审批，不推进项目。暂停、离屏、页面后台与系统减少动态时停止循环，保留文字引导。

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

本机分配老板账号：运行 `npm run owner:provision`，保留已有密码，缺少密码时生成随机值；凭据写入被 Git 忽略的 `.local-admin-credentials.txt`，文件权限为 0600，终端不会输出密码。指定账号用 `npm run owner:provision -- --username hifirst`；主动更换密码用 `npm run owner:provision -- --rotate-password`，之后重启服务。此命令只修改本机配置，不修改部署平台。

服务端把有效内部会话映射为 `owner`，按经营查看、项目、批价、核款、交付、客服、增长、公司设置、资料、审计和账号 11 类权限保护操作。客户公开注册不能授予内部身份。客户账号项目的会话过期后回到登录页，登录和注册切换保留原项目路径，重新登录后仍校验项目归属；返回地址限制在该角色的站内白名单。

## Pro 密钥开通与检查

当前版本使用服务端 `customer_memberships` 判断账号 Free / Pro 权益，有效 Pro 账号可直接进入高级工作模块，不要求重复报价、上传付款截图或老板开通审核。定位与公开发布仍由客户确认；定价尚未公布，暂未开放在线购买。账号流程与历史项目边界见[当前角色与业务流程](../docs/roles-and-workflows.md)。升级现有环境前，需执行 `npm run db:migrate`，应用证据溯源和账号权益迁移。

以下说明保留给历史项目的报价与单项目密钥入口。免费出海机会报告完成后，可使用：

- **申请 Pro 报价**：起草提案 → 经营者核价 → 客户接受 → 扫码付款、上传截图 → 票据员读取 → 经营者核对实际到账 → 制定策略。申请报价只将项目标记为 Pro 待开通，上传截图或 AI 识别成功都不会自动授予正式服务权限。
- **输入 Pro 密钥**：服务器验证密钥后，直接开通当前项目并排队制定策略，用于内部检查、演示或授权体验。后续定位、发布和交付仍走现有审批及验收流程。

在 `.env.local` 配置 `PRO_ACCESS_KEY`（32–256 字符），可用 `openssl rand -hex 32` 生成独立随机值。它与 `ADMIN_PASSWORD`、`SESSION_SECRET`、模型 API Key 相互独立，不能使用 `NEXT_PUBLIC_` 前缀，也不应提交到仓库。修改后重启 Web 服务；Vercel 需在目标环境配置该变量并重新部署。

打开免费报告下方的「升级到 Pro」，输入密钥并点击「验证密钥并开通 Pro」。已经申请报价的项目在等待经营者核价、客户接受、付款核验时也能使用；正在起草报价或读取截图时，等待当前任务结束再开通。暂停项目需先恢复，尚未完成免费报告的项目不能用密钥跳过初检。登录项目与持有专属链接的试用项目均可使用，授权范围是当前项目。

密钥是可复用的授权入口，持有者可开通多个符合条件的项目；不是一次性兑换码，也不是付款证明。留空或更换密钥会关闭旧密钥的新开通能力，已开通项目保留权限。校验失败使用统一提示，不保存或回传输入值；入口沿用当前应用的每进程 IP 限流（15 分钟 5 次，非跨实例全局限流）。

密钥开通使用 `projects.productPlan=pro`、`requiresPayment=false`、`proAccessSource=key`，订单状态为 `key_activated`，`decisions` 保存 `pro_access` 授权及范围版本，`state_transitions` 保存流转。权限、订单、审计与 pg-boss 任务一并提交；任务入队失败则全部回滚，重复开通不重复派发。不会创建 `payments`，实收金额和已付款订单数不增加；验收核对授权记录，不要求虚构到账。启动本机 Worker 或部署的队列消费者后，任务才会实际执行。

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
- **免费出海机会分析：** `/projects/new` 由 Lumi 根据描述动态追问，一次提取多项信息，支持流式回复、动态选项、对话修订和截图理解。需求草稿随对话更新，核心信息齐备后由客户确认创建，再自动分析出海机会，完成后可了解 Pro 高级模块。首页兔子对话与项目页共享草稿；兼容旧表单草稿，对话和文本保存在当前浏览器，截图只保留在本次页面会话中。未确认前不创建项目。内部建项仍使用完整表单。
- **历史订单收款需要人工核对：** 老板在经营台上传收款码。历史报价项目的客户接受报价后能扫码并上传截图，票据员提取信息，老板确认实际到账后才进入定位。账号 Pro 直接使用高级模块；密钥仅授权对应项目，均不记作实收。
- **每日站会：** Worker 在北京时间 09:00 生成一次站会。老板可以手动提前生成。工位提醒运行超过 30 分钟的任务和超过 24 小时的老板待办。周报使用生成时的累计经营快照。
- **发布版本：** 修改英文文案或选用产品截图会新建版本。旧版保持可用，直到新版完成声明检查及所需确认后替换；账号 Pro 由客户确认，历史项目保留双方审批。
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

## 账号版本与复测

有效 Pro 账号登录后默认进入 `/account/pro`，Free 账号进入 `/account`。免登录试用继续保留；首客老板使用独立的 `/admin/login`。Pro 定价尚未确定，升级页仅介绍权益。详细角色、模块依赖、历史授权与账务边界见[当前流程约定](../docs/roles-and-workflows.md)。

```bash
npm run db:migrate
npm run accounts:seed-test
npm run audit:source
npm run verify:roles
```

`verify:roles` 需要本机网页在 `http://127.0.0.1:3100` 运行。测试密码位于本机 `.local-test-accounts.json`，不会进入 Git。示例项目不自动执行模型任务；本机正常执行还需另开一个 `npm run worker` 进程。审计结果写入 `../reports/source-flow-audit-2026-11-08/`。
