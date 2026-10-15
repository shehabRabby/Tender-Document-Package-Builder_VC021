"use client";

import { m } from "framer-motion";
import { formatNumber, type TranslationDictionary } from "@/lib/i18n";
import type { GenerationFeedback, PackageProgress } from "@/lib/package-pdf";
import { isBlockingStatus } from "@/lib/status";
import type { DocumentStatus, Language, ReadinessSummary } from "@/lib/types";
import { Icon } from "./icon";

interface PackageReadinessProps {
  summary: ReadinessSummary;
  hasTender: boolean;
  disabled: boolean;
  generating: boolean;
  progress: PackageProgress | null;
  feedback: GenerationFeedback | null;
  onGenerate: () => void;
  language: Language;
  t: TranslationDictionary;
}

export function PackageReadiness({ summary, hasTender, disabled, generating, progress, feedback, onGenerate, language, t }: PackageReadinessProps) {
  const ready = summary.canGenerate;
  const message = ready ? t.readyHint
    : !hasTender ? t.startHint
    : summary.total === 0 ? t.noRequirements
    : summary.blocking > 0
      ? (summary.blocking === 1 ? t.blockingHintSingle : t.blockingHint).replace("{count}", formatNumber(summary.blocking, language))
      : t.assignmentReview;
  const blockingStatuses = (Object.keys(summary.statusCounts) as DocumentStatus[]).filter(isBlockingStatus);

  return <section id="generation-panel" className={`panel p-4 sm:p-6 ${ready ? "ready-panel" : ""}`} aria-labelledby="readiness-heading">
    <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.65fr)]">
      <div className="min-w-0"><p className="mb-2 text-xs font-medium text-muted-foreground">{t.generationStep}</p><h2 id="readiness-heading" className="text-base font-semibold text-foreground">{t.generateHeading}</h2>
        <div role="status" className="mt-3 flex items-start gap-2.5"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ready ? "border-success/25 bg-success/10 text-success" : summary.blocking > 0 ? "border-warning/25 bg-warning/10 text-warning" : "border-border bg-muted/50 text-muted-foreground"}`}><Icon name={ready ? "check" : hasTender ? "alert" : "document"} className="h-4 w-4" /></span><div className="min-w-0">{hasTender && <p className={`text-sm font-semibold ${ready ? "text-success" : "text-foreground"}`}>{ready ? t.ready : t.review}</p>}<p id="readiness-message" className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{message}</p></div></div>
        {summary.blocking > 0 && <ul className="mt-3 flex flex-wrap gap-2 text-xs" aria-label={t.blocking}>{blockingStatuses.filter((status) => summary.statusCounts[status] > 0).map((status) => <li key={status} className="rounded-lg border border-destructive/20 bg-destructive/8 px-2 py-1 text-destructive">{t.statuses[status]}: <span className="font-semibold">{formatNumber(summary.statusCounts[status], language)}</span></li>)}</ul>}
      </div>
      <div className="min-w-0 md:pt-3"><m.button id="generate-package" type="button" disabled={!ready || disabled} aria-busy={generating} aria-describedby="readiness-message export-notice" onClick={onGenerate} whileTap={ready && !disabled ? { scale: 0.985 } : undefined} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"><Icon name="fileCheck" className="h-4 w-4 shrink-0" /><span>{generating ? t.generatingPackage : t.generatePackage}</span><Icon name="arrow" className="h-4 w-4 shrink-0" /></m.button><p id="export-notice" className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.generationHint}</p></div>
    </div>
    {generating && progress && <div role="status" className="mt-4 text-xs leading-relaxed text-primary"><p>{t.generationStages[progress.stage]} · {formatNumber(progress.completed, language)} / {formatNumber(progress.total, language)}</p><progress className="mt-2 h-1.5 w-full accent-primary" max={progress.total || 1} value={progress.completed} aria-label={t.generatingPackage} /></div>}
    {!generating && feedback?.type === "success" && <p role="status" className="mt-4 break-all rounded-xl border border-success/20 bg-success/8 p-3 text-xs leading-relaxed text-success">{t.packageDownloaded.replace("{filename}", () => feedback.filename)}</p>}
    {!generating && feedback?.type === "error" && <div role="alert" className="error-box mt-4"><p className="font-semibold">{t.packageGenerationError}</p>{feedback.filename && <p className="mt-1 break-all font-medium">{feedback.filename}</p>}<p className="mt-1">{t.packageErrors[feedback.code]}</p></div>}
  </section>;
}
