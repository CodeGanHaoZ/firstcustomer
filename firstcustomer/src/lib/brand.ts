import type { Locale } from "@/lib/locale";

export const OFFICE_CHARACTERS = {
  frontdesk: { name: "lumi", chineseName: "露米", animal: "奶油兔" },
  research: { name: "nori", chineseName: "小枭", animal: "猫头鹰" },
  strategy: { name: "fino", chineseName: "赤狐", animal: "狐狸" },
  finance: { name: "milo", chineseName: "松栗", animal: "松鼠" },
  launch: { name: "kito", chineseName: "蓝狸", animal: "浣熊" },
  growth: { name: "pogo", chineseName: "芽芽", animal: "青蛙" },
  owner: { name: "toby", chineseName: "托比", animal: "金毛犬" },
  coo: { name: "yuki", chineseName: "云团", animal: "绵羊" },
} as const;

export type OfficeCharacterKey = keyof typeof OFFICE_CHARACTERS;
export const characterDisplayName = (key: OfficeCharacterKey, locale: Locale = "zh") => locale === "en" ? OFFICE_CHARACTERS[key].name : `${OFFICE_CHARACTERS[key].name} ${OFFICE_CHARACTERS[key].chineseName}`;

export const BRAND = {
  name: "首客",
  englishName: "HiFirst",
  mascotName: OFFICE_CHARACTERS.frontdesk.name,
  agentName: "Lumi Agent",
} as const;
