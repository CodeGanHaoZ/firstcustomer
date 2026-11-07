export type LumiMessage = { role: "user" | "assistant"; content: string };

export const LUMI_MESSAGE_LIMIT = 600;
export const LUMI_REPLY_LIMIT = 1200;
export const LUMI_HISTORY_LIMIT = 9;

export const LUMI_STARTERS = [
  {
    question: "我有 MVP，想找首批用户",
    reply: "好，我们先找一群最可能用得上它的人。你的产品帮谁解决了什么问题？",
  },
  {
    question: "我还在想法阶段",
    reply: "那我们先把想法说具体一点。你最想帮哪一类人解决什么问题？",
  },
  {
    question: "免费出海机会分析包含什么？",
    reply: "提交项目后会自动免费分析出海机会。你会看到值得优先验证的候选人群、出海机会报告，以及下一步需要验证的问题。",
  },
] as const;

export const LUMI_STARTERS_EN = [
  { question: "I have an MVP and need my first users", reply: "Let’s find a group most likely to need it. Who does your product help, and what problem does it solve?" },
  { question: "I’m still at the idea stage", reply: "Let’s make the idea concrete. Who do you most want to help, and with what problem?" },
  { question: "What’s included in the free opportunity analysis?", reply: "After submission, the free opportunity analysis starts automatically. You’ll see potential audiences, a market opportunity report, and what to validate next." },
] as const;

export const LUMI_CHAT_COPY = {
  zh: { frontdesk: "首客前台", guide: "MiMo AI 出海引导", close: "关闭对话", log: "对话记录", greeting: "你在做什么产品？还在想法阶段、有了 MVP，还是已经上线了？", hello: "嗨，我是", user: "你说：", said: "说：", starters: "试着这样开场", replying: "正在回复", retry: "重试", input: "给 lumi 发消息", placeholder: "说说你的产品，或问个问题…", send: "发送消息", cta: "免费分析出海机会", rateLimit: "消息有点多，请稍等再试。你也可以直接免费分析出海机会。", unavailable: "这次没收到回复。你可以重试，或直接免费分析出海机会。" },
  en: { frontdesk: "HiFirst front desk", guide: "Your MiMo AI go-to-market guide", close: "Close conversation", log: "Conversation", greeting: "What are you building? Is it an idea, an MVP, or already live?", hello: "Hi, I’m", user: "You: ", said: "says: ", starters: "Try a conversation starter", replying: "is replying", retry: "Try again", input: "Message lumi", placeholder: "Tell me about your product, or ask a question…", send: "Send message", cta: "Analyze your market opportunity for free", rateLimit: "A few too many messages. Please try again shortly, or start your free opportunity analysis.", unavailable: "No reply this time. Try again, or start a free opportunity analysis." },
} as const;
