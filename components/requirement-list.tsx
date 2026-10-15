import { formatNumber, type TranslationDictionary } from "@/lib/i18n";
import { m } from "framer-motion";
import { getFileAssignment } from "@/lib/matching";
import { sortRequirements } from "@/lib/requirements";
import { getRequirementStatus } from "@/lib/status";
import type { DocumentMatches, DocumentStatus, ExpiryDateState, Language, TenderData, UploadedPdf } from "@/lib/types";
import { Icon } from "./icon";

const statusStyles: Record<DocumentStatus, string> = {
  MISSING: "border-destructive/25 bg-destructive/8 text-destructive",
  EXPIRY_NEEDED: "border-warning/25 bg-warning/10 text-warning",
  EXPIRED: "border-destructive/25 bg-destructive/8 text-destructive",
  NOT_PROVIDED: "border-border bg-muted/60 text-muted-foreground",
  OK: "border-success/25 bg-success/10 text-success",
};

interface RequirementListProps {
  data: TenderData | null;
  files: readonly UploadedPdf[];
  matches: DocumentMatches;
  expiryDates: ExpiryDateState;
  language: Language;
  t: TranslationDictionary;
  disabled: boolean;
  onMatch: (requirementId: string, fileId: string) => void;
  onExpiry: (requirementId: string, date: string) => void;
}

export function RequirementList({ data, files, matches, expiryDates, language, t, disabled, onMatch, onExpiry }: RequirementListProps) {
  if (!data) return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name="document" className="h-7 w-7" /></span>
      <h3>{t.noTender}</h3>
      <p>{t.noTenderHint}</p>
    </div>
  );
  if (data.requirements.length === 0) return <div className="empty-state"><p>{t.noRequirements}</p></div>;

  return (
    <ol className="divide-y divide-border">
      {sortRequirements(data.requirements).map((requirement, index) => {
        const file = files.find((candidate) => candidate.id === matches[requirement.id]);
        const status = getRequirementStatus(requirement, file, expiryDates[requirement.id], data.tender.submission_deadline);
        const title = language === "bn" ? requirement.title_bn : requirement.title_en;
        const inputId = `requirement-${index}`;
        return (
          <li key={requirement.id} className="requirement-row" data-status={status}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 px-1 font-mono text-xs font-medium tabular-nums text-muted-foreground">{formatNumber(requirement.order, language)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold leading-relaxed text-foreground">{title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs leading-relaxed">
                      <span className="break-all font-mono font-medium text-muted-foreground">{requirement.id}</span>
                      <span className={`rounded-md border border-border px-1.5 py-0.5 ${requirement.mandatory ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}>{requirement.mandatory ? t.mandatory : t.optional}</span>
                      {requirement.has_expiry && <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-warning"><Icon name="clock" className="h-3 w-3 shrink-0" />{t.needsExpiry}</span>}
                    </div>
                  </div>
                  <m.span key={status} initial={{ opacity: 0.65 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} aria-live="polite" aria-atomic="true" className={`status-badge ${statusStyles[status]}`}>
                    <Icon name={status === "OK" ? "check" : status === "NOT_PROVIDED" ? "pending" : status === "EXPIRY_NEEDED" ? "clock" : "alert"} className="h-3.5 w-3.5 shrink-0" />{t.statuses[status]}
                  </m.span>
                </div>
                <p id={`${inputId}-status`} className={`mt-2 text-xs leading-relaxed ${status === "EXPIRED" ? "text-destructive" : "text-muted-foreground"}`}>{t.statusHints[status]}</p>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className={file && requirement.has_expiry ? "min-w-0" : "min-w-0 sm:col-span-2"}>
                    <label htmlFor={inputId} className="field-label">{file ? t.changeDocument : t.document}</label>
                    <select id={inputId} aria-label={`${t.document}: ${title}`} aria-describedby={`${inputId}-status${files.length === 0 ? ` ${inputId}-empty` : ""}`} title={file?.name} className="field" disabled={disabled || files.length === 0} value={file?.id ?? ""} onChange={(event) => onMatch(requirement.id, event.target.value)}>
                      <option value="">{t.selectDocument}</option>
                      {files.map((candidate) => {
                        const assignment = getFileAssignment(candidate, matches, files, requirement.id);
                        const owner = data.requirements.find((item) => item.id === assignment?.requirementId);
                        const ownerTitle = owner ? language === "bn" ? owner.title_bn : owner.title_en : assignment?.requirementId;
                        const explanation = assignment ? `${assignment.isDuplicate ? t.sameContentInUse : t.inUse}: ${ownerTitle}` : "";
                        return <option key={candidate.id} value={candidate.id} disabled={assignment !== null}>{candidate.name}{assignment ? ` (${explanation})` : ""}</option>;
                      })}
                    </select>
                    {files.length === 0 && <p id={`${inputId}-empty`} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t.noPdfsForMatching}</p>}
                  </div>
                  {file && requirement.has_expiry && (
                    <div className="min-w-0">
                      <label htmlFor={`${inputId}-expiry`} className="field-label">{t.expiryLabel}</label>
                      <input id={`${inputId}-expiry`} aria-describedby={`${inputId}-hint ${inputId}-status`} aria-invalid={status === "EXPIRY_NEEDED" || status === "EXPIRED"} className="field" type="date" min="0001-01-01" max="9999-12-31" disabled={disabled} value={expiryDates[requirement.id] ?? ""} onChange={(event) => onExpiry(requirement.id, event.target.value)} />
                      <p id={`${inputId}-hint`} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t.expiryHint} <span className="font-medium">{data.tender.submission_deadline}</span></p>
                    </div>
                  )}
                </div>
                {file && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/35 px-3 py-1.5">
                  <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs leading-relaxed text-muted-foreground" title={file.name}><Icon name="document" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{file.name}</span></p>
                  <button type="button" disabled={disabled} aria-label={`${t.unmatch}: ${title}`} onClick={() => onMatch(requirement.id, "")} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"><Icon name="close" className="h-3.5 w-3.5" />{t.unmatch}</button>
                </div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
