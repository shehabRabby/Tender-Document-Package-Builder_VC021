"use client";

import { m } from "framer-motion";
import { formatNumber, type TranslationDictionary } from "@/lib/i18n";
import type { Language, ReadinessSummary } from "@/lib/types";
import { Icon, type IconName } from "./icon";

export function PackageMetrics({ summary, language, t }: { summary: ReadinessSummary; language: Language; t: TranslationDictionary }) {
  const counts: { id: string; value: number; label: string; icon: IconName; style: string }[] = [
    { id: "total", value: summary.total, label: t.requirements, icon: "layers", style: "text-primary" },
    { id: "ok", value: summary.ok, label: t.okCount, icon: "fileCheck", style: "text-success" },
    { id: "blocking", value: summary.blocking, label: t.blocking, icon: "alert", style: summary.blocking > 0 ? "text-destructive" : "text-muted-foreground" },
    { id: "not-provided", value: summary.notProvided, label: t.notProvidedCount, icon: "optional", style: "text-muted-foreground" },
  ];
  const relevant = summary.total - summary.notProvided;
  const percent = relevant > 0 ? Math.round(summary.ok / relevant * 100) : summary.canGenerate ? 100 : 0;
  return <section id="readiness-section" aria-labelledby="metrics-heading" className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="metrics-heading" className="text-sm font-semibold text-foreground">{t.packageReadiness}</h2><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon name="shield" className="h-3.5 w-3.5" />{t.validationProgress}</span></div>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {counts.map(({ id, value, label, icon, style }, index) => <m.div key={id} className={`metric-card ${style}`} initial={{ opacity: 0.96, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: index * 0.04 }}>
        <div className="mb-3 flex items-center justify-between gap-2"><Icon name={icon} className="h-4 w-4" /><span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" aria-hidden="true" /></div>
        <dd id={`readiness-${id}`} className="text-2xl font-semibold leading-none tabular-nums">{formatNumber(value, language)}</dd>
        <dt className="mt-2 break-words text-xs font-medium leading-relaxed text-muted-foreground">{label}</dt>
      </m.div>)}
    </dl>
    <div className="mt-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{formatNumber(summary.ok, language)} / {formatNumber(relevant, language)} {t.readyDocuments}</span><span className="font-semibold tabular-nums text-primary">{formatNumber(percent, language)}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t.validationProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} /></div>
    </div>
  </section>;
}
