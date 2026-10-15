import type { TranslationDictionary } from "@/lib/i18n";
import type { Tender } from "@/lib/types";
import { Icon, type IconName } from "./icon";

export function TenderSummary({ tender, t }: { tender: Tender; t: TranslationDictionary }) {
  const metadata: { label: string; value: string; icon: IconName; emphasized?: boolean }[] = [
    { label: t.procuringEntity, value: tender.procuring_entity, icon: "building" },
    { label: t.bidder, value: tender.bidder, icon: "bidder" },
    { label: t.deadline, value: tender.submission_deadline, icon: "calendar", emphasized: true },
  ];
  return <section className="panel p-4 sm:p-6" aria-labelledby="tender-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon name="document" className="h-4 w-4 text-primary" />{t.tenderOverview}</p><span className="max-w-full break-all rounded-lg border border-primary/20 bg-accent px-2.5 py-1 font-mono text-xs font-medium text-primary">{t.tenderId} · {tender.tender_id}</span></div>
    <h2 id="tender-title" className="mt-3 break-words text-lg font-semibold tracking-tight text-foreground sm:text-xl">{tender.title}</h2>
    <dl className="mt-5 grid gap-3 sm:grid-cols-3">{metadata.map(({ label, value, icon, emphasized }) => <div key={label} className={`min-w-0 rounded-xl border p-3 ${emphasized ? "border-primary/20 bg-accent/50" : "border-border bg-muted/25"}`}><dt className="flex items-start gap-1.5 text-xs text-muted-foreground"><Icon name={icon} className="mt-0.5 h-3.5 w-3.5 shrink-0" />{label}</dt><dd className={`mt-2 break-words text-sm font-medium ${emphasized ? "text-primary" : "text-foreground"}`}>{value}</dd></div>)}</dl>
  </section>;
}
