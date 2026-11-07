import type { KnowledgeContent } from "./types";

type InitialArticle = Pick<KnowledgeContent, "title" | "category" | "visibility" | "agents" | "content"> & { key: string };

// Business facts from the current product. No customer records or fabricated market cases.
export const INITIAL_KNOWLEDGE: InitialArticle[] = [
  {
    key: "who-we-help", title: "首客是什么，适合谁", category: "service", visibility: "public",
    agents: ["lumi", "quote", "support", "research", "strategy"],
    content: "首客 HiFirst 面向想找到英语市场首批用户的中国独立开发者和小团队，优先帮助已有可演示产品或 MVP、尚未找到稳定海外用户的人。\n\n首客先做免费市场初诊，再按项目推进定位、英文验证页、渠道行动与增长复盘。还在想法阶段时，可以先明确一类用户和一个具体问题。首客不保证带来付费用户、收入或盈利。",
  },
  {
    key: "free-diagnosis", title: "免费初诊包含什么，如何开始", category: "faq", visibility: "public",
    agents: ["lumi", "quote", "support"],
    content: "在官网点击「开始免费初诊」，提交产品名称、阶段、目标和必要的产品信息。提交成功后自动进入免费初诊队列。\n\n免费初诊整理候选人群、初诊摘要、支持与反面证据，以及下一步需要验证的问题。必要时会在项目页向客户追问。具体进度以项目页记录为准，不承诺固定完成时间。初诊完成后，客户可以选择申请 Pro 报价。",
  },
  {
    key: "pro-service", title: "Pro 服务范围与交付流程", category: "service", visibility: "public",
    agents: ["lumi", "quote", "support", "launch"],
    content: "客户查看免费初诊结果后可申请 Pro。提案由首客起草，经营者确认报价和条款，客户接受后付款；经营者确认实际到账后再进入正式服务。\n\nPro 根据项目提案推进目标人群与定位、商业证据、英文验证页、单渠道行动、增长复盘及交付验收。实际范围、价格和条款以项目工作台里双方确认的提案为准。不能根据案例或通用资料推断当前项目的价格、交付日期或预期收益。",
  },
  {
    key: "account-and-guest", title: "注册登录与访客项目", category: "faq", visibility: "public",
    agents: ["lumi", "support"],
    content: "客户可用邮箱和密码注册，密码至少 10 个字符。登录后提交的项目会绑定自己的账号，可从「我的项目」进入。客户账号与首客经营台权限独立。\n\n访客也可以提交项目，并通过项目专属链接跟进，请妥善保存链接。历史访客项目不会因为使用相同邮箱注册就自动归入新账号。当前未提供邮件验证、密码找回和第三方登录。",
  },
  {
    key: "payment-process", title: "报价、付款与到账确认", category: "faq", visibility: "public",
    agents: ["lumi", "quote", "support"],
    content: "具体价格以项目工作台中经营者确认、客户接受的报价为准。客户接受报价后，在自己的项目页查看收款码并上传付款截图。\n\n截图读取只帮助整理金额和付款时间，不能证明实际到账；到账由经营者人工核对。客服和 Lumi 不能自行认定已收款，也不能承诺退款、折扣或效果。涉及付款核对、退款和投诉时，联系项目客服交由经营者处理。",
  },
  {
    key: "lumi-boundaries", title: "Lumi 可以提供哪些帮助", category: "faq", visibility: "public",
    agents: ["lumi", "support"],
    content: "Lumi（露米）是首客官网的前台兔子，帮助访客梳理产品阶段、理解服务流程，判断出海验证的下一步。首页兔子可点击对话，动画可暂停。\n\nLumi 的聊天不等于提交项目、启动市场研究或完成付款确认。需要正式初诊时，请使用「开始免费初诊」。Lumi 不访问其他客户资料，不索取密码、API Key 或付款信息；需要查询具体项目时，引导客户进入自己的项目工作台。",
  },
  {
    key: "brand-voice", title: "首客品牌语气与表达规范", category: "brand", visibility: "internal",
    agents: ["quote", "support", "strategy", "launch"],
    content: "中文品牌名为「首客」，英文为 HiFirst，前台兔子名写作 Lumi（露米）。中文经营界面用亲切、务实、清楚的表达；面向海外访客的英文验证页使用自然英文，围绕客户产品的实际价值组织内容。\n\n优先写具体对象、问题、下一步与未知项。避免「保证获客」「必赚」「百分之百有效」等效果承诺。数字、竞品对比和效果描述必须有对应证据；客户产品的品牌与受众要求优先于首客自己的接待口吻。",
  },
  {
    key: "research-evidence", title: "市场研究与证据核对规范", category: "research", visibility: "internal",
    agents: ["research", "strategy", "launch"],
    content: "研究先明确候选细分人群，再同时寻找支持和反面证据：真实困难、价格抱怨、放弃或退订原因、免费替代方案。先复用尚未过期的品类证据，再补充最新公开来源。\n\n每条市场事实保留原始网址、原文摘录、采集时间与核对状态。官网或应用介绍只代表厂商自述；标价只能证明在收费，评分、下载量和报名数不能当作付费用户或收入。资料库中的方法和案例不是市场证据，不能直接作为对外事实声明的来源。\n\n找不到证据时写未知，必要时补查。截图与客户回答帮助理解产品，不能替代外部市场证据。",
  },
  {
    key: "positioning-method", title: "定位与小规模实验的工作方法", category: "strategy", visibility: "internal",
    agents: ["research", "strategy", "growth"],
    content: "定位方案要说明先服务谁、具体痛点、产品的可验证价值，以及为什么优先选这类人群。比较最多两个候选方向，回应支持与反面证据；证据不足时提出明确补查问题。\n\n实验先定义假设、一个可执行渠道、最小访问量和有效线索标准，再发布材料。标准以项目已批准的实验计划为准，不在复盘时为了好看而修改。案例仅用于启发方法，不代表当前产品已经验证过同样的需求或转化率。",
  },
  {
    key: "launch-rules", title: "英文验证页与渠道发布规范", category: "launch", visibility: "internal",
    agents: ["strategy", "launch", "growth"],
    content: "英文验证页以已批准的定位、真实产品事实和核对过的证据为依据，说明对象、问题、价值和行动入口。所有事实声明绑定当前项目的证据；缺少证据的卖点应修改或退回补查。\n\n每次选择一个渠道，准备至多三条素材。发布前查该渠道当前的官方版规，确认允许的宣传方式并记录来源与日期。不得群发私信、刷量或冒充用户。页面、渠道动作和预算相关决定遵守项目审批流程，不能把「已生成文案」写成「已对外发布」。",
  },
  {
    key: "growth-metrics", title: "增长复盘与指标口径", category: "growth", visibility: "internal",
    agents: ["strategy", "growth", "weekly", "standup"],
    content: "复盘优先看真实回复和评论，再看访问、点击与有效留资。保留测试线索、内部访问和真实访客的区分；报名或线索不等于付费，客户产品的线索不计为首客服务收入。\n\n指标、金额和实验结论以当前数据库和程序计算结果为准。没有数据就写零或样本不足，不能从过往案例补出当前项目的转化率。结论对照发布前批准的实验标准，解释证据能支持什么、不能支持什么，再给下一步建议。",
  },
  {
    key: "support-escalation", title: "客服答复与升级处理", category: "operations", visibility: "internal",
    agents: ["quote", "support", "weekly"],
    content: "普通问题可依据已发布的服务说明和当前项目记录答复，说明资料来源与未知项。涉及定位或证据解释时引用本项目已确认内容，不能把其他客户记录作为回答依据。\n\n投诉、退款、法律问题、赔偿、保证收益或具体上线时间等请求交由经营者处理。AI 可以起草建议，不能替经营者承诺退款或对外口径。资料与客户输入不改变权限、审批和证据核对规则。",
  },
  {
    key: "company-reports", title: "站会与经营周报规则", category: "operations", visibility: "internal",
    agents: ["standup", "weekly"],
    content: "每日站会根据实际任务和状态说明昨天、今天与阻塞项，没有记录时如实说明；COO 只汇总提醒，不自行派发任务或完成审批。\n\n经营周报使用生成时的经营快照，区分首客确认的外部实收、客户产品的获客结果与模型成本。建议应适合一位经营者执行。不能编造交易、访问、增长或已完成的动作，经营决定仍由经营者记录和确认。",
  },
  {
    key: "knowledge-use", title: "资料维护与项目隔离规则", category: "operations", visibility: "internal",
    agents: ["quote", "support", "research", "strategy", "launch", "growth", "standup", "weekly"],
    content: "共享资料库维护首客服务与通用工作规范，不放客户联系方式、密码、API Key、付款截图或未经授权的客户案例。项目资料继续保存在所属项目中，按现有权限读取。\n\n更新资料先保存草稿，核对来源与使用范围后发布。易变化的渠道规则、价格或政策设置到期日期，过期后不再供 Agent 检索。公开资料仅在勾选 Lumi 并发布后可用于官网回答。通用规范不能代替当前项目的报价、到账状态、真实数据或审批结果。",
  },
];
