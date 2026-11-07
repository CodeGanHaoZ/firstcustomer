export const HOME_COPY = {
  zh: {
    nav: { home: "首客首页", label: "官网导航", office: "办公室", plans: "版本", flow: "服务流程", start: "开始", account: "我的项目", auth: "登录 / 注册", menu: "打开菜单" },
    hero: { eyebrow: "HIFIRST · AI 出海办公室", title: "你的产品，第一批海外客户在哪里？", description: "告诉首客你在做什么。MiMo AI 出海团队帮你研究市场、找到细分用户、准备英文发布和增长实验，用真实反馈决定下一步。", cta: "开始免费初诊", office: "看看办公室" },
    statsLabel: "首客数字", stats: [{ value: 6, unit: "位", label: "AI 员工同班" }, { value: 6, unit: "步", label: "完整服务流程" }, { value: 2, unit: "档", label: "Free 与 Pro" }, { value: 1, unit: "次", label: "免费市场初诊" }],
    office: { title: "首客办公室 · 演示", description: "从一次接待到一轮复盘，看看六位 AI 同事怎样一起工作。" },
    plans: { title: "Free 与 Pro", description: "适合已有可演示产品或 MVP、但还没有稳定海外用户的中国独立开发者和小团队。", freeTitle: "Free · 市场初诊", freeDescription: "提交项目，查看候选人群、初诊摘要和待验证项。", freeCta: "开始初诊", proTitle: "Pro · 出海验证", proDescription: "完整定位、英文验证页、渠道行动和增长复盘。初诊完成后可申请报价。", proCta: "先初诊再升级" },
    flow: { title: "服务流程", steps: [
      ["免费初诊", "提交后自动开始，整理候选人群和待验证项。"],
      ["选择 Pro", "看完初诊结果后，可申请 Pro 提案。接受报价并确认到账后，继续做定位和发布。"],
      ["确认方向", "老板把关并推荐，你来确认先卖给谁、验证什么。"],
      ["英文页面", "生成真实可访问的英文验证页。事实声明没有证据，程序不让送审。"],
      ["真实发布", "你确认后执行一项推广实验，记录发布链接。"],
      ["数据复盘", "先看真实回复，再看访问和留资。样本不够就如实写样本不足。"],
    ] },
    boundaries: { title: "服务边界", description: "先说清楚不做什么，再谈做什么。", items: ["不保证带来付费用户或收入", "不做群发私信、刷量或冒充用户", "没有数据就显示零，报名不算收入", "对外发布和预算支出都要你确认"] },
    cta: { firstLine: "让第一批客户", secondLine: "找到你", description: "从一次免费初诊开始：候选人群、待验证项、英文验证页，全部基于可追溯的证据。", register: "注册账号" },
    footer: { privacy: "Pro 服务以项目工作台中确认的报价为准。我们只把你提交的信息用于交付和必要联系。", contact: "联系方式", noContact: "建立项目后可通过专属链接联系首客客服。", start: "开始", submit: "提交项目", account: "账号", login: "登录", register: "注册" },
  },
  en: {
    nav: { home: "HiFirst home", label: "Main navigation", office: "Our office", plans: "Plans", flow: "How it works", start: "Get started", account: "My projects", auth: "Log in / Sign up", menu: "Open menu" },
    hero: { eyebrow: "HIFIRST · YOUR AI GO-TO-MARKET TEAM", title: "Who will be your first overseas customers?", description: "Tell us what you’re building. Our MiMo-powered team helps you research markets, find a focused audience, and prepare English pages and growth experiments. Real feedback guides the next step.", cta: "Start a free review", office: "Meet the team" },
    statsLabel: "HiFirst at a glance", stats: [{ value: 6, unit: "", label: "AI teammates" }, { value: 6, unit: "", label: "Steps from idea to feedback" }, { value: 2, unit: "", label: "Plans: Free & Pro" }, { value: 1, unit: "", label: "Free market review" }],
    office: { title: "Inside the HiFirst office", description: "From your first conversation to a growth review, see how six AI teammates work together." },
    plans: { title: "Free & Pro", description: "For independent developers and small teams in China with a demo or MVP, looking for their first consistent overseas users.", freeTitle: "Free · Market review", freeDescription: "Submit your project to explore potential audiences, an initial review, and what still needs testing.", freeCta: "Start your review", proTitle: "Pro · Market validation", proDescription: "Positioning, an English validation page, channel actions, and a growth review. Request a quote after your free review.", proCta: "Start free, then upgrade" },
    flow: { title: "How it works", steps: [
      ["Free review", "Starts after submission, with potential audiences and questions to validate."],
      ["Choose Pro", "Request a proposal after your review. Positioning and launch work continue once you accept the quote and payment is confirmed."],
      ["Confirm a direction", "The owner reviews and recommends. You confirm who to reach first and what to test."],
      ["Build an English page", "Get a real, accessible validation page. Factual claims need supporting evidence before approval."],
      ["Run an experiment", "Approve a promotion experiment, carry it out, and record the published link."],
      ["Review real feedback", "Look at replies, visits, and leads. If the sample is too small, we say so."],
    ] },
    boundaries: { title: "Clear expectations", description: "Know the limits before we get to work.", items: ["No guarantee of paying customers or revenue", "No mass DMs, fake traffic, or impersonation", "No data means zero. Sign-ups are not revenue.", "Publishing and spending require your approval"] },
    cta: { firstLine: "Help your first", secondLine: "customers find you", description: "Start with a free review of potential audiences and questions to test. With Pro, build an English validation page grounded in traceable evidence.", register: "Create an account" },
    footer: { privacy: "Pro services follow the quote confirmed in your project workspace. We use your submitted information only for delivery and necessary contact.", contact: "Contact:", noContact: "Once you create a project, contact support through your private project link.", start: "Get started", submit: "Submit a project", account: "Account", login: "Log in", register: "Sign up" },
  },
} as const;

export const OFFICE_COPY = {
  zh: { label: "首客办公室协作情景演示", demo: "协作情景演示", static: "静态浏览", paused: "已暂停", beats: ["整理任务", "当面交接", "接收后继续工作"], play: "播放", pause: "暂停", playLabel: "播放办公室演示", pauseLabel: "暂停办公室演示", replay: "重播", replayLabel: "重播当前协作片段", next: "下一幕", nextLabel: "查看下一幕协作", handoff: "交接中", chapters: "选择办公室协作片段", fallback: "当前显示静态场景，仍可点选角色与片段查看协作内容。", retry: "重新加载动画", team: "认识你的 AI 同事", teamDescription: "六种分工，一起把想法推进到真实验证。", output: "交付", collaboration: "协作", watch: "观看协作", selected: "正在了解", owner: "金毛老板，负责关键审批", coo: "绵羊 COO，负责站会与经营复盘", supporting: "右上角还有" },
  en: { label: "HiFirst office collaboration demo", demo: "Collaboration demo", static: "Still view", paused: "Paused", beats: ["Preparing the task", "Handing it over", "Back to work"], play: "Play", pause: "Pause", playLabel: "Play office demo", pauseLabel: "Pause office demo", replay: "Replay", replayLabel: "Replay this scene", next: "Next scene", nextLabel: "View next collaboration scene", handoff: "Handoff", chapters: "Choose a collaboration scene", fallback: "Showing a still scene. You can still select teammates and read each conversation.", retry: "Reload animation", team: "Meet your AI teammates", teamDescription: "Six specialties, working toward real validation.", output: "Delivers", collaboration: "Works with", watch: "Watch a scene", selected: "Now exploring", owner: "the golden retriever owner, who reviews key approvals", coo: "the sheep COO, who prepares standups and business reviews", supporting: "At the top right:" },
} as const;
