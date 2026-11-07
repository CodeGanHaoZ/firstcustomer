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
    question: "免费初诊包含什么？",
    reply: "提交项目后会自动开始免费初诊。你会看到值得优先验证的候选人群、市场初诊摘要，以及下一步需要验证的问题。",
  },
] as const;
