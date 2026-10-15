"use client";

import { useEffect, useRef } from "react";
import type { TranslationDictionary } from "@/lib/i18n";
import { Icon } from "./icon";

export function WorkspaceIntro({ tenderId, t }: { tenderId?: string; t: TranslationDictionary }) {
  const scope = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let context: { revert: () => void } | undefined;
    void import("gsap").then(({ gsap }) => {
      if (disposed || !scope.current) return;
      context = gsap.context(() => {
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          gsap.fromTo("[data-intro-accent]", { scaleX: 0.3, opacity: 0.4 }, { scaleX: 1, opacity: 1, duration: 0.32, ease: "power2.out", transformOrigin: "left center" });
        });
        return () => media.revert();
      }, scope);
    });
    return () => { disposed = true; context?.revert(); };
  }, []);

  return <div ref={scope} className="intro-surface panel px-4 py-5 sm:px-6 sm:py-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon name="dashboard" className="h-3.5 w-3.5" />{t.workspaceEyebrow}</span>{tenderId && <span className="max-w-full break-all rounded-md border border-primary/20 bg-accent px-2.5 py-1 font-mono text-xs font-medium text-primary">{tenderId}</span>}</div>
    <h1 className="text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl">{t.workspaceHeading}</h1>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t.introduction}</p>
    <div data-intro-accent className="mt-4 h-0.5 w-12 rounded-full bg-primary/70" aria-hidden="true" />
  </div>;
}
