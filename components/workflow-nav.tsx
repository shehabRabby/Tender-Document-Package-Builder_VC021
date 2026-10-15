import { formatNumber, type TranslationDictionary } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import { Icon, type IconName } from "./icon";

export function WorkflowNav({ hasTender, hasDocuments, matchingComplete, ready, generated, language, t }: { hasTender: boolean; hasDocuments: boolean; matchingComplete: boolean; ready: boolean; generated: boolean; language: Language; t: TranslationDictionary }) {
  const steps: { label: string; hint: string; target: string; icon: IconName; complete: boolean }[] = [
    { label: t.workflowTender, hint: t.workflowTenderHint, target: "tender-input", icon: "document", complete: hasTender },
    { label: t.workflowDocuments, hint: t.workflowDocumentsHint, target: "documents-input", icon: "folder", complete: hasDocuments || ready },
    { label: t.workflowMatching, hint: t.workflowMatchingHint, target: "checklist-section", icon: "checklist", complete: matchingComplete },
    { label: t.workflowValidation, hint: t.workflowValidationHint, target: "readiness-section", icon: "shield", complete: ready },
    { label: t.workflowGenerate, hint: t.workflowGenerateHint, target: "generation-panel", icon: "fileCheck", complete: generated && ready },
  ];
  const current = steps.findIndex((step) => !step.complete);
  return (
    <nav aria-label={t.workflowLabel} className="min-w-0 lg:sticky lg:top-28">
      <div className="mb-5 hidden items-center gap-2 px-3 text-xs font-semibold tracking-wider text-muted-foreground lg:flex"><Icon name="dashboard" className="h-4 w-4" />{t.workflowLabel}</div>
      <ol className="grid min-w-0 grid-cols-5 gap-1 rounded-2xl border border-border bg-card p-1 lg:grid-cols-1 lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0">
        {steps.map((step, index) => {
          const state = step.complete ? "complete" : index === current ? "current" : "pending";
          return <li key={step.target} className="min-w-0"><a href={`#${step.target}`} className="nav-step flex-col gap-1.5 px-1 py-2 text-center lg:flex-row lg:gap-3 lg:px-3 lg:py-3 lg:text-left" data-state={state} aria-current={state === "current" ? "step" : undefined} aria-label={`${formatNumber(index + 1, language)}. ${step.label}: ${t.workflowStates[state]}`}>
            <span className="nav-step-icon h-7 w-7 rounded-lg lg:h-9 lg:w-9 lg:rounded-xl"><Icon name={step.complete ? "check" : step.icon} className="h-3.5 w-3.5 lg:h-4 lg:w-4" /></span>
            <span className="min-w-0"><span className="block break-words text-[11px] font-medium lg:text-sm">{step.label}</span><span className="mt-1 hidden text-[11px] font-normal leading-relaxed text-muted-foreground lg:block">{step.hint}</span></span>
            {state === "current" && <span className="ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full bg-primary lg:block" aria-hidden="true" />}
          </a></li>;
        })}
      </ol>
      <div className="mt-8 hidden rounded-2xl border border-border bg-card/60 p-4 lg:block"><Icon name="shield" className="mb-3 h-5 w-5 text-primary" /><p className="text-xs font-semibold text-foreground">{t.privateWorkspace}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.privacyHint}</p></div>
    </nav>
  );
}
