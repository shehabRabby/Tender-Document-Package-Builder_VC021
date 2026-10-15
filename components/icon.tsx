import { ArrowRight, Building2, CalendarDays, Check, CheckCheck, CircleDashed, CircleHelp, Clock3, FileCheck2, Files, FileText, FolderOpen, Languages, Layers3, LayoutDashboard, ListChecks, Moon, ShieldCheck, Sun, TriangleAlert, UploadCloud, UserRound, X } from "lucide-react";

const icons = {
  document: FileText, upload: UploadCloud, check: Check, close: X,
  shield: ShieldCheck, folder: FolderOpen, alert: TriangleAlert,
  sun: Sun, moon: Moon, arrow: ArrowRight, building: Building2,
  calendar: CalendarDays, bidder: UserRound, dashboard: LayoutDashboard,
  checklist: ListChecks, validated: CheckCheck, clock: Clock3,
  fileCheck: FileCheck2, files: Files, layers: Layers3,
  pending: CircleDashed, optional: CircleHelp, language: Languages,
};

export type IconName = keyof typeof icons;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const LucideIcon = icons[name];
  return <LucideIcon className={className} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
