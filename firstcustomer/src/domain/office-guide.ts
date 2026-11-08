import type { Gate } from "./approval";
import { DEPARTMENTS, officeRoomForAgent, type AgentState, type DepartmentKey } from "./office";
import type { ProjectPlan } from "./workflow";
import { characterDisplayName, type OfficeCharacterKey } from "@/lib/brand";
import type { Locale } from "@/lib/locale";

export type OfficeGuideInput = {
  status: string; paused: boolean; runningAgents: readonly string[];
  plan?: ProjectPlan; quoteRequired?: boolean; quotePaid?: boolean;
  openGate?: Gate | null; reportReady?: boolean; receiptUploaded?: boolean;
  deliveryStatus?: string; canStartFree?: boolean; failedFrom?: string | null;
  audience?: "customer" | "operator"; operatorTurn?: boolean; selfServicePro?: boolean; proInactive?: boolean;
  projectCheckout?: boolean; proOffer?: boolean;
};
export type OfficeGuide = {
  room: DepartmentKey | null;
  state: "working" | "queued" | "waiting" | "action" | "complete" | "failed" | "paused" | "closed";
  title: string; task: string; output: string;
  nextActor: OfficeCharacterKey | "customer" | null;
  next: string; condition: string; yourAction: string;
  link?: { href: string; label: string };
};
type Copy = readonly [string, string];
const WORK: Record<string, { room: DepartmentKey; agent: string; task: Copy; output: Copy }> = {
  researching: { room: "research", agent: "research", task: ["核对海外需求、竞品定价和反面证据，整理值得验证的人群。", "Check overseas demand, competitor pricing and counterevidence to identify audiences worth testing."], output: ["候选人群、来源证据和出海机会报告", "Candidate audiences, source evidence and an opportunity report"] },
  drafting_quote: { room: "frontdesk", agent: "quote", task: ["把研究结果整理成 Pro 服务范围、交付清单与提案草稿。", "Turn research into a Pro service scope, deliverables and a draft proposal."], output: ["项目服务范围与价格", "Project scope and price"] },
  reading_receipt: { room: "finance", agent: "receipt", task: ["读取付款凭证并整理可核对的信息，实际到账由经营者确认。", "Read payment proof and organize verifiable details. The operator confirms actual receipt."], output: ["凭证识别结果与待核对项", "Receipt details and items to verify"] },
  strategizing: { room: "strategy", agent: "strategy", task: ["比较目标人群，写清定位、实验假设和预先约定的判断标准。", "Compare audiences and define positioning, hypotheses and preset success criteria."], output: ["定位方案与验证计划", "Positioning options and a validation plan"] },
  preparing_page: { room: "launch", agent: "launch", task: ["根据已确认的定位制作英文验证页、核对事实声明并准备渠道素材。", "Build an English validation page from the approved positioning, check claims and prepare channel assets."], output: ["待审批的英文页面与渠道行动卡", "An English page and channel action card for approval"] },
  reviewing: { room: "growth", agent: "growth", task: ["把真实访问、留资和回复与预设标准对照，说明结果和不确定项。", "Compare real visits, leads and replies with preset criteria and explain results and uncertainties."], output: ["增长复盘与下一步建议", "A growth review and next-step recommendations"] },
};
const ROOM_FOR_STATUS: Record<string, DepartmentKey> = {
  submitted: "research", free_ready: "research", needs_info: "research",
  awaiting_quote: "frontdesk", awaiting_quote_acceptance: "frontdesk",
  awaiting_payment: "finance", awaiting_positioning: "strategy", awaiting_publish: "launch",
  published: "growth", collecting: "growth", delivered: "growth", awaiting_founder: "strategy",
};

// Presentation only: this describes persisted state and never advances a project.
export function officeGuidance(input: OfficeGuideInput, locale: Locale = "zh"): OfficeGuide {
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const c = (copy: Copy) => copy[locale === "en" ? 1 : 0];
  const name = (key: OfficeCharacterKey) => characterDisplayName(key, locale);
  const operator = input.audience === "operator";
  const work = (input.status === "reviewing" && input.reportReady) || !Object.hasOwn(WORK, input.status) ? undefined : WORK[input.status];
  const room = work?.room ?? (Object.hasOwn(ROOM_FOR_STATUS, input.status) ? ROOM_FOR_STATUS[input.status] : undefined) ?? (Object.hasOwn(WORK, input.failedFrom ?? "") ? WORK[input.failedFrom!].room : null);
  const running = work && (input.runningAgents.includes(work.agent) || (work.room === "research" && input.runningAgents.includes("vision")));
  const guide: OfficeGuide = {
    room, state: running ? "working" : work ? "queued" : "waiting",
    title: room ? t(`${name(room)} 正在处理这一步`, `${name(room)} is handling this stage`) : t("项目进度", "Project progress"),
    task: work ? c(work.task) : t("正在同步当前阶段的项目记录。", "Synchronizing the records for this stage."), output: work ? c(work.output) : t("本阶段的项目记录", "Records for this stage"),
    nextActor: null, next: "", condition: "",
    yourAction: t("暂时不用操作，任务完成后这里会自动更新。", "No action is needed right now. This view updates when the task finishes."),
  };
  const next = (actor: OfficeGuide["nextActor"], text: Copy, condition?: Copy) => {
    guide.nextActor = actor; guide.next = c(text); guide.condition = condition ? c(condition) : "";
  };
  const action = (href: string, label: Copy) => { guide.link = { href, label: c(label) }; };
  const customerApproval = (gate: Gate) => operator ? input.operatorTurn === false : input.openGate === gate;
  const approval = (gate: Gate, subject: Copy, actor: DepartmentKey, task: Copy) => {
    const customer = customerApproval(gate);
    guide.state = customer && !operator || !customer && operator ? "action" : "waiting";
    guide.title = customer ? t(`等待你确认${subject[0]}`, `Waiting for your approval: ${subject[1]}`) : t(`等待首客经营者把关${subject[0]}`, `Waiting for the operator to review ${subject[1]}`);
    if (operator && customer) guide.title = t(`等待客户确认${subject[0]}`, `Waiting for customer approval: ${subject[1]}`);
    guide.task = t("这一步需要人工确认，Agent 会等确认后再继续。", "This stage needs a human decision. The agent continues after approval.");
    guide.yourAction = customer ? (operator ? t("客户确认后自动进入后续任务。", "The next task starts after customer approval.") : t("查看当前版本，确认采用或提出修改。", "Review the current version, approve it or request changes.")) : (operator ? t("在项目详情核对当前版本，再交客户确认。", "Review the current version in project details, then request customer approval.") : t("首客团队正在把关，你现在不用重复提交。", "HiFirst is reviewing this stage. You do not need to resubmit."));
    next(actor, task, input.selfServicePro ? ["你确认当前版本后", "After you approve this version"] : ["双方确认当前版本后", "After both parties approve this version"]);
    if (guide.state === "action") action(operator ? "#decisions" : "#approval", ["查看待确认事项", "Review the pending decision"]);
  };
  if (work) {
    guide.title = running ? t(`${name(work.room)} 正在工作`, `${name(work.room)} is working`) : t(`${name(work.room)} 的任务已排队`, `${name(work.room)}’s task is queued`);
    if (!running) guide.yourAction = t("正在等待后台启动，不用重复提交。", "Waiting for the worker to start. You do not need to resubmit.");
  }
  switch (input.status) {
    case "submitted":
      guide.state = "queued"; guide.title = t("等待开始出海机会分析", "Waiting to start opportunity analysis");
      guide.task = t("先核对已提交的产品资料，再交给 Nori 研究。", "Check the submitted product details, then pass them to Nori for research.");
      guide.output = c(WORK.researching.output);
      next("research", ["Nori 研究海外需求与候选人群", "Nori researches overseas needs and candidate audiences"]);
      guide.yourAction = input.selfServicePro ? t("从 Pro 工作台选择模块启动，任务会在这里显示进度。", "Start a module from your Pro workspace to see its progress here.") : input.canStartFree ? t("确认启动免费分析后，Nori 才会开始。", "Nori starts after you confirm the free assessment.") : t("项目登记已保存，等待首客确认启动。", "Your brief is saved and waiting for HiFirst to start the work.");
      break;
    case "researching":
      if (input.plan === "free") next("customer", ["先查看免费的出海机会报告", "Review your free opportunity report"], ["研究完成后，是否购买 Pro 由你决定", "After research, you decide whether to purchase Pro"]);
      else if (input.quoteRequired && !input.quotePaid) next("customer", ["客户查看报告并决定是否购买 Pro", "The customer reviews the report and decides whether to buy Pro"], ["研究完成并保留来源后", "After research is complete with sources saved"]);
      else next("strategy", ["Fino 比较人群并制定定位", "Fino compares audiences and develops positioning"], ["研究材料核对通过后", "After the research material passes its checks"]);
      break;
    case "free_ready":
      guide.state = "complete"; guide.title = t("Nori 已完成免费出海机会报告", "Nori has completed your free opportunity report");
      guide.task = t("先看候选人群、证据与待验证的问题。Free 在这里交付结果。", "Review the audiences, evidence and open questions. This is the Free deliverable.");
      guide.output = c(WORK.researching.output); next("customer", ["了解 Pro 的高级工作模块", "Explore the advanced Pro modules"], ["本项目付款校验通过后继续", "Continue after payment verification for this project"]);
      guide.yourAction = t("先读报告，再确认 Pro 的服务范围与报价。", "Read the report, then review the Pro service scope and quote."); action("#diagnosis", ["查看出海机会报告", "View opportunity report"]); break;
    case "drafting_quote": next("customer", ["客户确认 Pro 服务并购买", "The customer confirms and buys Pro"], ["服务范围与价格准备好后", "After scope and price are ready"]); break;
    case "awaiting_quote":
    case "awaiting_quote_acceptance":
      guide.state = operator ? "waiting" : "action"; guide.title = t("等待客户确认 Pro 服务", "Waiting for the customer to confirm Pro");
      guide.task = t("项目改用自动定价，客户确认范围与价格后自助购买。", "Automatic pricing applies. The customer reviews scope and price before buying.");
      guide.output = t("项目服务范围与价格", "Project scope and price");
      next("finance", ["Milo 校验付款并自动开通项目", "Milo verifies payment and activates the project"], ["客户确认购买后", "After the customer confirms the purchase"]);
      guide.yourAction = operator ? t("等待客户购买，无需逐单批价。", "Wait for the customer to buy. No per-order pricing approval is needed.") : t("查看 Pro 服务并确认购买。", "Review the Pro service and confirm your purchase.");
      if (!operator) action("#pro", ["查看 Pro 服务", "View Pro service"]); break;
    case "awaiting_payment":
      if (input.projectCheckout) {
        guide.state = operator ? "waiting" : "action";
        guide.title = t("等待完成项目付款", "Waiting for project payment");
        guide.task = t("Milo 将校验订单与付款结果，通过后自动开通本项目。", "Milo checks the order and payment result, then activates this project automatically.");
        guide.output = t("项目付款与权益记录", "Project payment and access records");
        next("strategy", ["Fino 开始制定定位与验证计划", "Fino starts the positioning and validation plan"], ["付款校验通过后", "After payment verification"]);
        guide.yourAction = operator ? t("等待客户付款，无需逐单核款或开通。", "Wait for payment; verification and activation are automatic.") : t("核对项目范围和金额，完成付款即可开始。", "Review the project scope and amount, then pay to begin.");
        if (!operator) action("#payment", ["前往付款", "Go to payment"]);
        break;
      }
      guide.state = input.receiptUploaded ? (operator ? "action" : "waiting") : (operator ? "waiting" : "action");
      guide.title = input.receiptUploaded ? t("等待经营者核对实际到账", "Waiting for payment verification") : t("等待付款凭证", "Waiting for payment proof");
      guide.task = t("付款凭证与真实到账分别核对，不会用动画代替收款确认。", "Payment proof and actual receipt are checked separately. Animation does not confirm payment."); guide.output = c(WORK.reading_receipt.output);
      next("strategy", ["Fino 开始制定定位与验证计划", "Fino starts the positioning and validation plan"], ["首客确认实际到账后", "After HiFirst confirms receipt of funds"]);
      guide.yourAction = input.receiptUploaded ? (operator ? t("核对最新凭证与实际到账金额。", "Verify the latest proof and amount received.") : t("凭证已提交，等待首客核对。", "Your proof is submitted. Wait for HiFirst to verify it.")) : (operator ? t("等待客户上传付款凭证。", "Wait for the customer to upload payment proof.") : t("按已确认报价付款，再上传付款截图。", "Pay the accepted quote and upload payment proof."));
      if (guide.state === "action") action(operator ? "#decisions" : "#payment", ["查看付款事项", "View payment details"]); break;
    case "reading_receipt": next("owner", ["经营者核实实际到账后，再交 Fino", "The operator verifies receipt before handing off to Fino"]); break;
    case "strategizing": next(input.selfServicePro ? "customer" : "owner", input.selfServicePro ? ["由你确认定位方向", "You approve the positioning direction"] : ["经营者把关，再请你确认定位", "Operator review, then your positioning approval"]); break;
    case "awaiting_positioning": guide.output = c(WORK.strategizing.output); approval("positioning", ["定位", "positioning"], "launch", ["Kito 按确认的定位准备英文验证页", "Kito prepares an English page from the approved positioning"]); break;
    case "preparing_page": next(input.selfServicePro ? "customer" : "owner", input.selfServicePro ? ["由你确认是否公开页面", "You approve whether to publish the page"] : ["经营者把关，再请你确认是否公开", "Operator review, then your approval to publish"]); break;
    case "awaiting_publish": guide.output = c(WORK.preparing_page.output); approval("publish", ["发布", "publishing"], "growth", ["Pogo 收集真实访问、留资与回复", "Pogo collects real visits, leads and replies"]); break;
    case "published": case "collecting":
      guide.state = "waiting"; guide.title = t("Pogo 在等待真实反馈", "Pogo is waiting for real feedback"); guide.task = t("页面已经公开，接下来执行已批准的渠道行动并积累样本。", "The page is public. Carry out approved channel actions and gather a sample."); guide.output = t("真实访问、留资和回复记录", "Real visit, lead and reply records");
      next("growth", ["Pogo 按预设标准复盘本轮实验", "Pogo reviews the experiment against preset criteria"], ["样本达到要求并启动复盘后", "After the sample is sufficient and the review is started"]);
      guide.yourAction = operator ? t("记录真实渠道执行，样本足够后启动复盘。", "Record actual channel execution and start the review when the sample is sufficient.") : t("可以查看英文页与反馈记录；当前不是 Agent 故障。", "You can review the page and feedback records. Waiting for data is not an agent failure."); break;
    case "reviewing":
      if (input.reportReady && input.selfServicePro && input.openGate !== "next_round") {
        guide.state = "complete"; guide.title = t("本轮增长复盘已完成", "This growth review is complete"); guide.output = c(WORK.reviewing.output);
        guide.yourAction = t("查看复盘结果与已保存的交付内容。", "Review the results and saved deliverables."); action("#growth", ["查看增长复盘", "View growth review"]);
      }
      else if (input.reportReady) { guide.output = c(WORK.reviewing.output); approval("next_round", ["下一轮实验", "the next experiment"], "strategy", ["确认下一轮后，Fino 调整策略", "If another round is approved, Fino adjusts the strategy"]); }
      else next("owner", ["查看复盘，决定交付或下一轮", "Review the results and decide on delivery or another round"]); break;
    case "needs_info":
      guide.state = operator ? "waiting" : "action"; guide.title = t("Nori 需要补充资料", "Nori needs more information"); guide.task = t("先补充本轮追问，未知的信息可以如实保留。", "Answer the current questions and leave uncertain details as unknown."); guide.output = t("补充后的需求记录", "Updated requirement records"); next("research", ["Nori 带着补充资料继续研究", "Nori continues research with the additional details"]);
      guide.yourAction = operator ? t("等待客户回答，或在项目详情选择继续研究。", "Wait for customer answers or choose to continue research in project details.") : t("回答工作台中的追问，再保存提交。", "Answer the workspace questions and save your responses."); action(operator ? "#decisions" : "#clarifications", ["查看补充问题", "View clarification questions"]); break;
    case "delivered":
      guide.state = input.deliveryStatus === "accepted" ? "complete" : operator ? "waiting" : "action";
      guide.title = input.deliveryStatus === "accepted" ? t("本次服务已完成验收", "This delivery has been accepted") : t("交付已准备好，等待验收", "Delivery is ready for acceptance"); guide.task = t("交付清单与历次确认记录都可以继续查阅。", "The deliverables and approval history remain available."); guide.output = t("本次服务交付清单", "The service deliverables"); guide.yourAction = input.deliveryStatus === "accepted" ? t("可以随时回看已交付的内容。", "You can return to the delivered material at any time.") : t("确认验收，或写明需要修改的地方。", "Accept the delivery or explain what needs changing."); action("#deliverables", ["查看交付清单", "View deliverables"]); if (input.deliveryStatus !== "accepted") next("customer", ["由项目发起人确认验收", "The project owner accepts the delivery"]); break;
    case "failed":
      guide.state = "failed"; guide.title = t("这一步遇到问题，需要先处理", "This stage needs attention before it can continue"); guide.task = t("已保存的材料保留，核查失败原因后才能重试。", "Saved material is preserved. Check the cause before retrying."); guide.yourAction = operator ? t("查看执行记录，核查后重试当前步骤。", "Check the execution log, resolve the issue and retry the stage.") : t("联系首客核查进度，不需要重复新建项目。", "Ask HiFirst to investigate. You do not need a new project."); next("owner", ["经营者核查原因后恢复处理", "The operator investigates and resumes processing"]); action(operator ? "#tasks" : "#support", ["查看处理入口", "View support options"]); break;
    case "awaiting_founder":
      guide.title = t("等待首客经营者决定下一步", "Waiting for the operator’s decision"); guide.task = t("前序材料已保留，先由经营者判断继续补查还是调整方向。", "Previous material is saved. The operator decides whether to investigate further or change direction."); next("owner", ["裁决后再交给对应 Agent", "Hand off to the appropriate agent after the decision"]); guide.yourAction = operator ? t("查看待裁决事项，给出继续处理的方向。", "Review the pending decision and choose how to proceed.") : t("等待首客处理，可通过客服询问。", "Wait for HiFirst or ask support for an update."); guide.state = operator ? "action" : "waiting"; action(operator ? "#decisions" : "#support", ["查看待处理事项", "View pending items"]); break;
    case "cancelled":
      guide.room = null; guide.state = "closed"; guide.title = t("项目已取消", "Project cancelled"); guide.task = t("历史材料仍可查看，当前不会启动新的任务。", "Historical material remains available. No new tasks will start."); guide.yourAction = t("如需继续，请联系首客。", "Contact HiFirst if you would like to continue."); break;
  }
  if (input.proOffer && input.status !== "free_ready") {
    guide.room = "frontdesk"; guide.state = operator ? "waiting" : "action";
    guide.title = t("待确认 Pro 服务", "Review Pro service");
    guide.task = t("核对当前项目的服务范围与价格，付款校验后自动开通并执行。", "Review this project's scope and price. Work starts automatically after payment verification.");
    guide.output = t("项目服务范围与价格", "Project scope and price");
    next("customer", ["确认 Pro 服务并购买", "Confirm and buy Pro"]);
    guide.yourAction = operator ? t("等待客户购买，无需逐单批价。", "Wait for the customer to buy. No per-order approval is needed.") : t("查看 Pro 服务并确认购买。", "Review the Pro service and confirm your purchase.");
    if (!operator) action("#pro", ["查看 Pro 服务", "View Pro service"]);
  }
  if (input.paused && !["delivered", "cancelled"].includes(input.status)) {
    const finishing = input.runningAgents.map(officeRoomForAgent).find((key) => key !== undefined);
    guide.room = finishing ?? guide.room; guide.state = finishing ? "working" : "paused";
    guide.title = finishing ? t(`${name(finishing)} 正在收尾，之后暂停`, `${name(finishing)} is finishing before pausing`) : t("项目已暂停", "Project paused");
    guide.nextActor = null; guide.next = t("恢复项目后才会开始下一步", "The next stage starts after the project resumes"); guide.condition = "";
    guide.yourAction = operator ? t("在项目设置中恢复后继续。", "Resume the project in its settings to continue.") : t("联系首客恢复项目，已保存的内容会保留。", "Contact HiFirst to resume. Saved material is preserved."); delete guide.link;
  }
  if (input.proInactive && !["cancelled", "delivered"].includes(input.status)) {
    guide.room = null; guide.state = "waiting"; guide.title = t("Pro 账号权益当前不可用", "Pro account access is unavailable");
    guide.task = t("已保存的项目资料仍可查看，高级任务等待账号权益恢复。", "Saved project records remain available. Advanced tasks wait for account access to be restored.");
    guide.nextActor = "customer"; guide.next = t("核对账号版本后继续", "Check your account plan to continue"); guide.condition = "";
    guide.yourAction = t("前往账号工作台核对权益，可通过客服寻求帮助。", "Check your account access or ask support for help."); action("/account/upgrade", ["查看账号版本", "View account plan"]);
  }
  return guide;
}

export function customerOfficeStations(input: OfficeGuideInput) {
  const guide = officeGuidance(input);
  const running = new Set(input.status === "cancelled" ? [] : input.runningAgents.map(officeRoomForAgent));
  const currentState: Record<OfficeGuide["state"], AgentState> = { working: "running", queued: "scheduled", waiting: "awaiting_approval", action: "awaiting_approval", complete: "completed", failed: "failed", paused: "paused", closed: "idle" };
  return DEPARTMENTS.map(({ key }) => ({ key,
    state: (running.has(key) ? "running" : key === guide.room ? (["published", "collecting"].includes(input.status) ? "waiting" : currentState[guide.state]) : "idle") as AgentState,
    detail: running.has(key) ? "正在处理你的项目" : key === guide.room ? "当前流程所在工位" : "当前项目在该工位暂无运行中的任务",
  }));
}
