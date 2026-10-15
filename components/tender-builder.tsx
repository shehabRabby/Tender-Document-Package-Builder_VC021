"use client";

import { useReducer, useRef, useState } from "react";
import { formatFileSize, formatNumber, formatValidationError, translations } from "@/lib/i18n";
import { MAX_PDF_FILES, MAX_TOTAL_BYTES, uploadPdfFiles } from "@/lib/pdf";
import { downloadPackagePdf, generatePackagePdf, PackagePdfError, type GenerationFeedback, type PackageProgress } from "@/lib/package-pdf";
import { parseRequirementsJson } from "@/lib/requirements";
import { getReadinessSummary } from "@/lib/status";
import type { Language, ValidationError } from "@/lib/types";
import { initialWorkspace, workspaceReducer } from "@/lib/workspace";
import { FilePicker } from "./file-picker";
import { Icon } from "./icon";
import { PackageReadiness } from "./package-readiness";
import { RequirementList } from "./requirement-list";
import { TenderSummary } from "./tender-summary";
import { UploadedFiles } from "./uploaded-files";
import { DashboardHeader } from "./dashboard-header";
import { WorkflowNav } from "./workflow-nav";
import { WorkspaceIntro } from "./workspace-intro";
import { PackageMetrics } from "./package-metrics";

type JsonLoadError =
  | { type: "file"; code: "notJson" | "jsonReadFailed" }
  | { type: "validation"; details: ValidationError };

export function TenderBuilder() {
  const [language, setLanguage] = useState<Language>("en");
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspace);
  const [jsonError, setJsonError] = useState<JsonLoadError | null>(null);
  const [jsonFilename, setJsonFilename] = useState("");
  const [busy, setBusy] = useState<"json" | "pdf" | "package" | null>(null);
  const [generationFeedback, setGenerationFeedback] = useState<GenerationFeedback | null>(null);
  const [packageProgress, setPackageProgress] = useState<PackageProgress | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const processing = useRef(false);
  const t = translations[language];
  const disabled = busy !== null;
  const totalBytes = state.files.reduce((total, file) => total + file.size, 0);
  const summary = getReadinessSummary(state.data, state.files, state.matches, state.expiryDates);
  const jsonErrorMessage = jsonError?.type === "validation"
    ? formatValidationError(jsonError.details, language)
    : jsonError ? t[jsonError.code] : null;

  async function loadJson(files: File[]) {
    if (processing.current) return;
    const file = files[0];
    if (!file) return;
    if (!/\.json$/i.test(file.name) || (file.type !== "" && !["application/json", "text/json", "text/plain", "application/octet-stream"].includes(file.type))) {
      setJsonError({ type: "file", code: "notJson" });
      return;
    }
    processing.current = true;
    setBusy("json");
    setJsonError(null);
    try {
      const result = parseRequirementsJson(await file.text());
      if (!result.ok) {
        setJsonError({ type: "validation", details: result });
        return;
      }
      dispatch({ type: "load-tender", data: result.value });
      setGenerationFeedback(null);
      setJsonFilename(file.name);
    } catch {
      setJsonError({ type: "file", code: "jsonReadFailed" });
    } finally {
      processing.current = false;
      setBusy(null);
    }
  }

  async function loadPdfs(files: File[]) {
    if (processing.current) return;
    processing.current = true;
    setBusy("pdf");
    setProgress({ completed: 0, total: files.length });
    try {
      const result = await uploadPdfFiles(files, state.files, (completed, total) => setProgress({ completed, total }));
      dispatch({ type: "add-files", files: result.files, errors: result.errors });
    } finally {
      processing.current = false;
      setBusy(null);
    }
  }

  async function generatePackage() {
    if (processing.current || !summary.canGenerate) return;
    processing.current = true;
    setBusy("package");
    setGenerationFeedback(null);
    setPackageProgress(null);
    try {
      const result = await generatePackagePdf(state.data, state.files, state.matches, state.expiryDates, setPackageProgress);
      downloadPackagePdf(result);
      setGenerationFeedback({ type: "success", filename: result.filename });
    } catch (error: unknown) {
      const failure = error instanceof PackagePdfError ? error : new PackagePdfError("GENERATION_FAILED");
      setGenerationFeedback({ type: "error", code: failure.code, filename: failure.filename });
    } finally {
      processing.current = false;
      setBusy(null);
    }
  }

  return (
    <div lang={language} className="min-h-screen">
      <DashboardHeader language={language} onLanguage={setLanguage} t={t} />
      <div className="mx-auto grid max-w-400 gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-8 xl:grid-cols-[216px_minmax(0,1fr)]">
        <aside className="min-w-0"><WorkflowNav hasTender={state.data !== null} hasDocuments={state.files.length > 0} matchingComplete={state.data !== null && summary.total > 0 && summary.statusCounts.MISSING === 0} ready={summary.canGenerate} generated={generationFeedback?.type === "success"} language={language} t={t} /></aside>
        <main id="main" tabIndex={-1} className="min-w-0 space-y-6 outline-none">
          <WorkspaceIntro tenderId={state.data?.tender.tender_id} t={t} />

          <div className="grid items-start gap-4 md:grid-cols-2">
            <section id="tender-input" className="panel p-4 sm:p-5" aria-labelledby="tender-heading">
              <div className="section-heading"><span className="step-number"><Icon name="document" className="h-5 w-5" /></span><div className="min-w-0"><h2 id="tender-heading">{t.stepOne}</h2><p>{t.stepOneHint}</p></div></div>
              <div className="upload-zone mt-4 min-h-36"><FilePicker id="json-upload" accept=".json,application/json" label={busy === "json" ? t.readingJson : state.data ? t.replaceJson : t.loadJson} disabled={disabled} onFiles={(files) => { void loadJson(files); }} secondary /><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.jsonFormat}</p></div>
              {jsonErrorMessage && <div role="alert" className="error-box mt-4"><p className="font-semibold">{t.jsonError}</p><p className="mt-1 break-words">{jsonErrorMessage}</p></div>}
              {state.data && <p className="mt-3 flex items-start gap-2 rounded-xl border border-success/20 bg-success/8 px-3 py-2.5 text-xs leading-relaxed text-success"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 break-all">{t.jsonLoaded} · {jsonFilename}</span></p>}
            </section>
            <section id="documents-input" className="panel p-4 sm:p-5" aria-labelledby="upload-heading" aria-busy={busy === "pdf"}>
              <div className="section-heading"><span className="step-number"><Icon name="upload" className="h-5 w-5" /></span><div className="min-w-0"><h2 id="upload-heading">{t.stepTwo}</h2><p>{t.stepTwoHint}</p></div></div>
              <div className="upload-zone mt-4 min-h-36"><FilePicker id="pdf-upload" accept=".pdf,application/pdf" label={t.choosePdfs} disabled={disabled} multiple onFiles={(files) => { void loadPdfs(files); }} /><p className="mt-3 text-xs font-medium text-muted-foreground">{t.uploadHint}</p><p className="mt-1 max-w-72 text-xs leading-relaxed text-muted-foreground">{t.uploadSubhint}</p></div>
              {busy === "pdf" && <div role="status" className="mt-4 text-xs text-primary"><p>{t.checkingFiles} · {formatNumber(progress.completed, language)} / {formatNumber(progress.total, language)}</p><progress className="mt-2 h-1.5 w-full accent-primary" max={progress.total || 1} value={progress.completed} aria-label={t.checkingFiles} /></div>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{formatNumber(state.files.length, language)} / {formatNumber(MAX_PDF_FILES, language)} {t.files}</span><span>{formatFileSize(totalBytes, language)} / {formatFileSize(MAX_TOTAL_BYTES, language)}</span></div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" role="meter" aria-label={t.uploadHint} aria-valuemin={0} aria-valuemax={MAX_TOTAL_BYTES} aria-valuenow={totalBytes}><div className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${Math.min(100, totalBytes / MAX_TOTAL_BYTES * 100)}%` }} /></div>
              {state.uploadErrors.length > 0 && <div role="alert" className="error-box mt-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{t.fileErrors}</p><button type="button" aria-label={t.dismiss} onClick={() => dispatch({ type: "dismiss-upload-errors" })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-destructive/10"><Icon name="close" className="h-4 w-4" /></button></div><ul className="mt-2 space-y-2">{state.uploadErrors.map((error, index) => <li key={`${error.filename}-${index}`}><span className="break-all font-medium">{error.filename}</span><p className="mt-0.5">{t.pdfErrors[error.code]}</p></li>)}</ul></div>}
            </section>
          </div>

          {state.data ? <TenderSummary tender={state.data.tender} t={t} /> : <section className="panel flex items-start gap-3 p-4 sm:p-5" aria-labelledby="overview-heading"><span className="empty-icon"><Icon name="building" className="h-5 w-5" /></span><div className="min-w-0"><h2 id="overview-heading" className="text-sm font-semibold">{t.tenderOverview}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.overviewHint}</p></div></section>}
          <PackageMetrics summary={summary} language={language} t={t} />
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
            <section id="checklist-section" className="panel overflow-hidden" aria-labelledby="checklist-heading" aria-busy={disabled}>
              <div className="border-b border-border px-4 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="checklist-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon name="checklist" className="h-4 w-4 text-primary" />{t.checklist}</h2>{state.data && <p className="rounded-lg border border-primary/20 bg-accent px-2.5 py-1 text-xs font-medium text-primary">{t.matchingProgress.replace("{matched}", formatNumber(Object.keys(state.matches).length, language)).replace("{total}", formatNumber(summary.total, language))}</p>}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.checklistHint}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.assignmentHint}</p></div>
              {state.matchingError && <p role="alert" className="error-box m-5">{t.matchingErrors[state.matchingError]}</p>}
              <RequirementList data={state.data} files={state.files} matches={state.matches} expiryDates={state.expiryDates} language={language} t={t} disabled={disabled} onMatch={(requirementId, fileId) => dispatch({ type: "match", requirementId, fileId })} onExpiry={(requirementId, date) => dispatch({ type: "expiry", requirementId, date })} />
            </section>
            <section className="panel overflow-hidden" aria-labelledby="files-heading"><div className="panel-heading"><h2 id="files-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon name="files" className="h-4 w-4 text-primary" />{t.uploadedFiles}</h2><span className="flex h-7 min-w-7 items-center justify-center rounded-lg border border-border bg-muted/40 px-2 text-xs font-medium tabular-nums text-muted-foreground">{formatNumber(state.files.length, language)}</span></div><UploadedFiles files={state.files} matches={state.matches} requirements={state.data?.requirements ?? []} language={language} t={t} disabled={disabled} onRemove={(fileId) => dispatch({ type: "remove-file", fileId })} /></section>
          </div>
          <PackageReadiness summary={summary} hasTender={state.data !== null} disabled={disabled} generating={busy === "package"} progress={packageProgress} feedback={generationFeedback} onGenerate={() => { void generatePackage(); }} language={language} t={t} />
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-4 text-xs text-muted-foreground"><span>{t.product} · {t.footer}</span><span className="inline-flex items-center gap-1.5"><Icon name="shield" className="h-3.5 w-3.5 text-success" />{t.localOnly}</span></footer>
        </main>
      </div>
    </div>
  );
}
