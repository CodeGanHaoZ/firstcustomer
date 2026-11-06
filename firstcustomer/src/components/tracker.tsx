"use client";

import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";

function track(slug: string, type: "visit" | "cta_click") {
  const body = JSON.stringify({ slug, type });
  navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
}

export function VisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    track(slug, "visit");
  }, [slug]);
  return null;
}

export function CtaLink(props: { slug: string; label: string; enabled: boolean }) {
  return (
    <a
      href="#lead-form"
      className={buttonVariants()}
      onClick={() => {
        if (props.enabled) track(props.slug, "cta_click");
      }}
    >
      {props.label}
    </a>
  );
}
