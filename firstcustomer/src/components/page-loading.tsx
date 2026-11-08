"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useLocale } from "@/components/locale-provider";

const ANIMAL_COUNT = 8;

export function PageLoading({ visible = true }: { visible?: boolean }) {
  const locale = useLocale();
  const [animal] = useState(() => Math.floor(Math.random() * ANIMAL_COUNT));
  const en = locale === "en";
  return (
    <div className="page-transition-overlay" data-visible={visible ? "true" : undefined} aria-hidden={!visible}>
      <div className="page-transition-card" role={visible ? "status" : undefined} aria-live="polite">
        <span className="page-transition-animal" style={{ "--animal-x": `${animal * 100 / 7}%` } as CSSProperties} aria-hidden="true" />
        <div className="page-transition-copy">
          <strong>{en ? "The office is getting ready" : "办公室正在准备下一站"}</strong>
          <span>{en ? "Your next workspace will be here in a moment." : "下一页马上就到，伙伴们正在整理资料。"}</span>
        </div>
        <span className="page-transition-status"><LoaderCircle size={15} aria-hidden="true" />{en ? "Loading" : "正在加载"}<i aria-hidden="true" /></span>
      </div>
    </div>
  );
}
