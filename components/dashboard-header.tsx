"use client";

import type { TranslationDictionary } from "@/lib/i18n";
import type { Language } from "@/lib/types";
import { Icon } from "./icon";
import { ThemeToggle } from "./theme-toggle";

export function DashboardHeader({ language, onLanguage, t }: { language: Language; onLanguage: (language: Language) => void; t: TranslationDictionary }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[var(--header)] backdrop-blur-lg">
      <a href="#main" className="sr-only rounded-xl bg-card px-4 py-3 text-sm text-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">{t.skipToWorkspace}</a>
      <div className="mx-auto flex max-w-400 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-6 lg:px-8">
        <a href="#main" className="flex min-w-0 basis-full items-center gap-3 rounded-xl sm:basis-auto">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-accent text-primary"><Icon name="fileCheck" className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="text-xs font-semibold leading-tight text-primary">TenderPack</p><p className="break-words text-sm font-semibold leading-snug tracking-tight text-foreground lg:text-base">{t.appTitle}</p><p className="mt-1 hidden text-xs leading-relaxed text-muted-foreground lg:block">{t.appSubtitle}</p></div>
        </a>
        <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden 2xl:inline-flex"><Icon name="shield" className="h-4 w-4 text-success" />{t.localOnly}</span>
          <div className="flex items-center gap-2">
            <ThemeToggle t={t} />
            <div className="flex rounded-xl border border-border bg-muted/50 p-1" role="group" aria-label={t.languageLabel}>
              {(["en", "bn"] as const).map((value) => <button key={value} type="button" lang={value} aria-pressed={language === value} onClick={() => onLanguage(value)} className={`min-h-11 min-w-11 rounded-lg px-3 py-2 text-xs font-semibold ${language === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>{value === "en" ? "EN" : "বাংলা"}</button>)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
