"use client";

import { LoaderCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { useLocale } from "@/components/locale-provider";

const ANIMAL_COUNT = 8;
const ANIMAL_STORAGE_KEY = "hifirst-loading-animal";

let cachedAnimal: number | null = null;

function readAnimal() {
  if (cachedAnimal !== null) return cachedAnimal;
  if (typeof window === "undefined") return 0;

  try {
    const stored = Number(window.sessionStorage.getItem(ANIMAL_STORAGE_KEY));
    cachedAnimal = Number.isInteger(stored) && stored >= 0 && stored < ANIMAL_COUNT
      ? stored
      : Math.floor(Math.random() * ANIMAL_COUNT);
    window.sessionStorage.setItem(ANIMAL_STORAGE_KEY, String(cachedAnimal));
  } catch {
    // Private browsing can reject sessionStorage. Keep the in-memory value
    // stable for the rest of this page instead of choosing on every render.
    cachedAnimal = Math.floor(Math.random() * ANIMAL_COUNT);
  }
  return cachedAnimal;
}

/** Rotate once per real navigation; every loading surface then reads the same value. */
export function advanceLoadingAnimal() {
  const next = (readAnimal() + 1) % ANIMAL_COUNT;
  cachedAnimal = next;
  try {
    window.sessionStorage.setItem(ANIMAL_STORAGE_KEY, String(next));
  } catch {
    // The in-memory value still keeps PageTransition and app/loading aligned.
  }
  return next;
}

export function PageLoading({ visible = true, animalIndex }: { visible?: boolean; animalIndex?: number }) {
  const locale = useLocale();
  // Keep the server and hydrated markup identical. Navigation supplies an
  // explicit next animal; the route-level loading boundary stays on the
  // stable first frame underneath it.
  const animal = animalIndex ?? 0;
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
