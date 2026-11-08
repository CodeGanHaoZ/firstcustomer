"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, MessageCircle } from "lucide-react";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import type { Locale } from "@/lib/locale";

const rabbit = "/brand/front-desk-rabbit.webp";

export function LumiWelcome({ paused, locale = "zh" }: { paused: boolean; locale?: Locale }) {
  return (
    <div className="brand-welcome-shell" data-open={paused ? "" : undefined}>
      <Dialog.Trigger className="brand-welcome">
        <span className="brand-welcome-orbit brand-welcome-orbit--one" aria-hidden="true" />
        <span className="brand-welcome-orbit brand-welcome-orbit--two" aria-hidden="true" />
        <span className="brand-welcome-chip brand-welcome-chip--left" aria-hidden="true">MI MO AI <b>·</b> 6 AGENTS</span>
        <span className="brand-welcome-chip brand-welcome-chip--right" aria-hidden="true">FIRST CUSTOMER LAB</span>
        <Image className="brand-welcome-rabbit" src={rabbit} alt="" width={640} height={640} unoptimized />
        <span className="brand-welcome-caption">
          <strong lang="en">{BRAND.mascotName}</strong><span>{locale === "en" ? "HiFirst office · Front desk" : "首客办公室 · 前台"}</span>
        </span>
        <span className="brand-welcome-status" aria-hidden="true"><span><i />{locale === "en" ? "Online reception" : "在线接待"}</span><span>01 / 06</span></span>
        <span className="brand-welcome-cta">
          <MessageCircle size={16} aria-hidden="true" /> {locale === "en" ? "Tell me about your product" : "聊聊你的产品"} <ArrowRight size={15} aria-hidden="true" />
        </span>
        </Dialog.Trigger>
    </div>
  );
}
