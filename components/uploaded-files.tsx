import { formatFileSize, formatNumber, type TranslationDictionary } from "@/lib/i18n";
import { getDuplicateFileIds, getFileAssignment } from "@/lib/matching";
import type { DocumentMatches, Language, TenderRequirement, UploadedPdf } from "@/lib/types";
import { Icon } from "./icon";

interface UploadedFilesProps {
  files: readonly UploadedPdf[];
  matches: DocumentMatches;
  requirements: readonly TenderRequirement[];
  language: Language;
  t: TranslationDictionary;
  disabled: boolean;
  onRemove: (fileId: string) => void;
}

export function UploadedFiles({ files, matches, requirements, language, t, disabled, onRemove }: UploadedFilesProps) {
  if (files.length === 0) return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name="folder" className="h-7 w-7" /></span>
      <h3>{t.noFiles}</h3>
      <p>{t.noFilesHint}</p>
    </div>
  );
  const duplicates = getDuplicateFileIds(files);
  const matchedIds = new Set(Object.values(matches));
  return (
    <>
    {duplicates.size > 0 && <p className="border-b border-warning/20 bg-warning/8 px-4 py-3 text-xs leading-relaxed text-warning sm:px-6">{t.duplicateExplanation}</p>}
    <ul className="divide-y divide-border">
      {files.map((file) => {
        const assignment = getFileAssignment(file, matches, files);
        const owner = requirements.find((item) => item.id === assignment?.requirementId);
        const ownerTitle = owner ? language === "bn" ? owner.title_bn : owner.title_en : assignment?.requirementId;
        return (
        <li key={file.id} className={`flex items-start gap-2.5 px-4 py-4 hover:bg-muted/30 sm:px-6 ${matchedIds.has(file.id) ? "bg-success/4" : ""}`}>
          <span className="mt-0.5 shrink-0 rounded-xl border border-primary/15 bg-accent p-2 text-primary"><Icon name="document" className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-relaxed text-foreground" title={file.name}>{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatNumber(file.pageCount, language)} {file.pageCount === 1 ? t.page : t.pages} <span aria-hidden="true">·</span> {formatFileSize(file.size, language)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {duplicates.has(file.id) && <span title={t.duplicateHint} className="inline-flex max-w-full items-center gap-1 rounded-md border border-warning/25 bg-warning/10 px-2 py-0.5 text-xs font-medium leading-relaxed text-warning">{t.duplicate}</span>}
              {matchedIds.has(file.id) && <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-success/25 bg-success/10 px-2 py-0.5 text-xs font-medium leading-relaxed text-success">{t.assigned}</span>}
            </div>
            {assignment && <p className="mt-1.5 break-words text-xs leading-relaxed text-muted-foreground">{assignment.isDuplicate ? t.sameContentAssignedTo : t.assignedTo}: <span className="font-medium text-foreground">{ownerTitle}</span></p>}
          </div>
          <button type="button" onClick={() => onRemove(file.id)} disabled={disabled} aria-label={`${t.remove}: ${file.name}`} title={t.remove} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </li>
      ); })}
    </ul>
    </>
  );
}
