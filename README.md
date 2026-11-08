# 首客 HiFirst

帮中国开发者找到产品在英语市场的第一批用户。

首客是一间由经营者带领 AI 员工工作的出海办公室：先做免费的出海机会分析，再按项目推进定位、英文验证页、渠道行动与增长复盘。新用户可免登录领取一轮完整 Pro 试用，之后可按 ¥99／项目另购三轮验证。AI 负责研究和起草，客户确认定位、发布与验收，经营者处理异常和历史订单，结果保留来源、任务状态和确认记录。

[在线体验](https://www.yomujp.top/) · [试用工作台](https://www.yomujp.top/account) · [创建项目](https://www.yomujp.top/projects/new) · [开发与部署说明](firstcustomer/README.md)

![首客首页：动态前台兔子 Lumi 与 AI 出海办公室](docs/images/homepage.jpg)

## 演示视频与比赛材料

| 材料 | 链接 |
| --- | --- |
| 产品演示视频 | [在线播放](https://kongleiwork-art.github.io/firstcustomer/) · [MP4 直链](https://kongleiwork-art.github.io/firstcustomer/hifirst-launch-v1-fast.mp4) |
| 营业日志、首单流程与成本分析 | [经营实证报告](https://kongleiwork-art.github.io/firstcustomer/evidence/) |
| 完整经营流水 | [在线查看与搜索 174 条记录](https://kongleiwork-art.github.io/firstcustomer/evidence/ledger/) · [下载 CSV](https://kongleiwork-art.github.io/firstcustomer/evidence/operating-ledger.csv) |

材料由 GitHub Pages 独立发布。经营实证为 2026-11-08 的导出快照，报告中的模拟成交与实际收款分别记录；当前项目状态以应用数据库为准。

## 设计与前端交接

最新的[办公室 UI/UX 设计交付包](docs/design-handoff/office-2026-11-08/README.md)包含离线交接页、六页 PDF、桌面与移动端截图、交互与状态规范、双语文案、样式令牌和源码映射，可直接转交前端与 UI/UX 团队。[下载完整 ZIP](docs/design-handoff/FirstCustomer-Office-UIUX-Handoff-2026-11-08.zip)。

## 当前功能

- **Lumi 动态接待**：前台兔子 Lumi（露米）会挥手、点头。点击兔子打开 Lumi Agent，聊产品阶段和出海问题，也可以直接进入免费出海机会分析。
- **动态办公室与接力流程**：工作状态用任务牌、动态工作条和动物动作呈现；角色与交付文件组成可点击的协作链路，显示下一位伙伴和需要人工确认的条件。六位 Agent 保持两列三行，手机可放大查看办公室并跟随当前协作。
- **中英文界面**：官网、登录注册、项目登记、客户工作台和内部经营台支持「中文 / EN」切换，刷新和站内跳转保留偏好；客户原始资料与已生成报告保留原文。
- **Lumi 对话内建项**：支持流式回复、动态选项、截图理解、草稿续填和对话修订。核心资料齐全后，在最后一条回复下方直接确认创建项目，再启动免费分析；尚未确认时不创建项目。
- **需求版本与工作包核验**：需求卡与补充回答保留历史，每个范围最多三轮澄清；交付前核对实际成果、审批、到账和复盘判据，旧版本确认无法覆盖新成果。详见[使用与核验说明](docs/requirements-and-verification.md)。
- **免登录工作台与账号归档**：访客可创建项目并通过专属链接跟进，当前浏览器保存最近 12 个项目入口 30 天。注册或登录后可将本浏览器持有有效凭据的项目归入账号，跨设备继续。
- **Free 出海机会报告**：确认项目后自动研究候选人群、竞品、付费信号、反面证据与待验证假设，必要时请求客户补充资料。
- **一轮完整 Pro 试用**：新用户无需登录、付款或老板审批即可领取一轮定位、英文验证页、渠道方案和复盘。当前浏览器限领一次，登录客户同时核对账号资格；试用后另购三轮，无自动收费。见[免登录试用说明](docs/pro-new-user-trial.md)。
- **¥99／项目／三轮验证**：同一产品与目标市场按项目自动报价，付款校验后自动开通。本轮复盘与交付检查完成后可使用剩余轮数，同轮修改和失败重试不扣新轮次。历史单轮订单按原快照保留。当前支付采用服务端模拟校验，后台与真实收入隔离；账号 Pro 和密钥授权继续兼容。见[购买链路](docs/pro-purchase-implementation.md)与[三轮套餐说明](docs/pro-pricing-service-v3.md)。
- **证据阅读与来源溯源**：市场证据每组默认显示 3 条，其余展开查看；反向检索单独呈现，保存的来源版本超过 5 条后收进抽屉。MiMo AI 可根据已保存证据生成来源与严谨性小结，失败可重试；小结用于辅助判断，不能替代原始证据核对。
- **经营者办公室**：六个部门展示真实任务状态，支持审批、打回、暂停、重试、任务板、每日站会、周报与公司卷宗导出。
- **OPC 老板经营台**：内部登录后处理项目异常、方案交付、客服升级、公司决策，以及历史订单的批价和核款；查看实收、成本、客户线索，按项目筛选决策和操作记录。新项目 Pro 购买无需逐单批价或人工核款。详见[经营台与后端检查说明](docs/owner-console.md)。
- **账号与双边协作设计**：老板账号分配、11 项服务端权限与登录返回已落实；服务商／开发者承接客户委托的流程、权限矩阵和交互规格见[双边协作设计](docs/two-sided-workflow-design.md)，新双边交易模块尚未上线。
- **共享资料库**：内置 14 篇服务与工作规范，支持文字和 Markdown/TXT 导入、草稿与发布、角色权限、到期停用、版本历史及检索预览。Lumi 和相关 Agent 读取各自可用的发布资料，详见[资料库使用说明](docs/knowledge.md)。
- **证据与经营记录**：对外声明绑定证据，记录真实访问和留资，分别统计首客实收与客户产品线索。

## 如何体验

1. 打开首页，点击 Lumi，介绍产品、阶段和目标；也可以直接进入[创建项目](https://www.yomujp.top/projects/new)。
2. 核对对话中整理的需求，点击「确认创建项目」，等待免费出海机会报告；无需先注册。
3. 在项目工作台查看证据、回答追问。符合资格时领取一轮完整 Pro 试用，确认定位与公开发布后，收集反馈并启动复盘、验收本轮成果。
4. 如需继续，可另购 ¥99 的三轮套餐。注册或登录用于归档成果、跨设备访问；有效账号 Pro 与历史订单继续保留原有权益。

官网中的办公室用于协作演示；客户在 `/account` 和项目专属工作台处理自己的项目。经营者使用独立内部账号登录 `/admin/login`，进入 `/admin/owner` 处理公司经营与异常。

## 六个部门

| 部门 | 角色 | 工作内容 |
| --- | --- | --- |
| 前台 | Lumi 露米 · 奶油兔 | 接待、整理需求与报告、项目客服；兼容历史报价任务 |
| 市场研究室 | Nori 小枭 · 猫头鹰 | 查找需求、竞品定价、付费信号与反面证据 |
| 战略决策室 | Fino 赤狐 · 狐狸 | 比较目标人群，形成定位和实验计划 |
| 财务室 | Milo 松栗 · 松鼠 | 新项目付款校验与开通；历史截图辅助识别，实际到账仍由经营者核对 |
| 产品发布室 | Kito 蓝狸 · 浣熊 | 制作英文验证页、渠道文案与发布材料 |
| 增长运营室 | Pogo 芽芽 · 青蛙 | 分析真实访问、回复和留资，给出复盘结论 |

金毛老板形象名为 **Toby 托比**；绵羊 COO 与经营周报助手名为 **Yuki 云团**。角色名集中维护在 `firstcustomer/src/lib/brand.ts`。

## 技术栈

| 层级 | 实现 |
| --- | --- |
| Web | Next.js 16 App Router、React 19、TypeScript |
| 界面 | Tailwind CSS 4、shadcn/ui、Base UI、Lucide |
| 客户账号 | Better Auth，邮箱与密码登录 |
| AI | 服务器端直连 Xiaomi MiMo，支持工具调用和备用模型配置 |
| 数据 | PostgreSQL、Drizzle ORM；线上使用 Neon |
| 后台任务 | pg-boss 保存任务；本机独立 Worker，线上由 Vercel Queues 唤起执行 |
| 部署 | Vercel、GitHub `main` 自动部署，保留 Docker Compose 方案 |

## 本地运行

需要 Node.js 22.12 或以上版本及 npm。应用位于仓库内的 `firstcustomer/` 子目录。

```bash
git clone https://github.com/kongleiwork-art/firstcustomer.git
cd firstcustomer/firstcustomer
npm ci
cp .env.example .env.local
```

在 `.env.local` 中填写本机使用的 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 和至少 32 字符的 `SESSION_SECRET`。密钥可用 `openssl rand -base64 32` 生成。暂时没有 MiMo Key 时，启用模拟模型：

```dotenv
LLM_PROVIDER=stub
ALLOW_STUB=1
```

在应用目录开三个终端，按顺序运行：

```bash
# 终端 1：本机 PostgreSQL，不需要 Docker
npm run db:dev
```

```bash
# 终端 2：建表并启动后台任务
npm run db:migrate && npm run worker
```

```bash
# 终端 3：启动网站
npm run dev
```

打开 [本机首页](http://localhost:3100) 或 [经营台](http://localhost:3100/admin)。模拟模式用于体验项目工作流，输出会标注为示例；Lumi 的自由对话需要真实模型。

接入 MiMo 时，在 `.env.local` 填写 `MIMO_API_KEY`，移除两行模拟模型配置，并重启网站和 Worker。Key 由服务器读取，访客无需提供自己的 Key。配置细节见 [应用开发文档](firstcustomer/README.md#模型配置)。

## 自动部署

当前 GitHub 仓库已连接 Vercel 项目 `hifirst`：

- 生产分支：`main`
- Root Directory：`firstcustomer`
- 正式网址：[www.yomujp.top](https://www.yomujp.top/)，Vercel 地址为 [hifirst.vercel.app](https://hifirst.vercel.app/)
- 推送或合并到 `main` 后自动构建，成功后更新正式网站；构建失败时保留当前线上版本。

数据库迁移需要先独立执行。生产构建通过 `npm run build:vercel` 只读检查迁移是否齐全，再执行构建；缺少迁移时阻止发布，构建不会自动改库。环境变量、云端队列、多域名认证和 Docker 配置见 [Vercel 部署说明](firstcustomer/README.md#vercel--neon)。

演示视频与比赛材料由 `codex/hifirst-video-pages` 分支发布到 GitHub Pages，与主应用分开部署。

## 仓库结构

```text
firstcustomer/       Next.js 应用、数据库迁移、Worker 和测试
brand/               品牌兔子原始素材与形象说明
docs/images/         README 使用的页面截图
PRODUCT.md           产品定位、用户与能力约束
DESIGN.md            视觉设计说明
首客_*.md            产品需求、验收与路演材料
```

常用开发命令在 `firstcustomer/` 中执行：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

GitHub Actions 在分支推送和 PR 更新时独立运行以上四项校验；集成测试自行创建临时 PostgreSQL，不需要生产数据库或模型密钥。

## 使用边界

当前版本是 JUNCTION CHINA 2026 · Xiaomi MiMo OPC 项目的 MVP，需求背景见 [PRD V4.2](首客_FirstCustomer_产品需求规格说明书_V4.2.md)，功能以当前代码为准。首客不保证带来付费客户或收入；定位和公开发布由客户确认，没有数据时如实显示样本不足。当前购买链路使用模拟支付，不发生真实扣款，不将试用、密钥授权或模拟成交计入实际收入；历史收款截图仍需经营者核对到账。渠道方案获批不等于已执行，应用不会自动替客户向外部平台发帖。
