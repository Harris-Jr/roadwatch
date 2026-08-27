import { cn } from "@/lib/utils";
import type { Severity, Status, Source, SyncState } from "@/lib/types";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  CloudUpload,
  Cog,
  Loader2,
  RefreshCw,
} from "lucide-react";

export function SeverityBadge({ level, className }: { level: Severity; className?: string }) {
  const map = {
    minor: { label: "Minor", cls: "bg-severity-minor/20 text-yellow-900 border-severity-minor" },
    moderate: { label: "Moderate", cls: "bg-severity-moderate/20 text-orange-900 border-severity-moderate" },
    severe: { label: "Severe", cls: "bg-severity-severe/20 text-red-900 border-severity-severe" },
  }[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border-l-4 px-2 py-1 text-xs font-semibold uppercase tracking-wide",
        map.cls,
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      {map.label}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const map = {
    reported: { label: "Reported", cls: "bg-status-reported/15 text-blue-900 ring-status-reported/40", Icon: ClipboardList },
    in_progress: { label: "In progress", cls: "bg-status-progress/15 text-orange-900 ring-status-progress/40", Icon: Cog },
    fixed: { label: "Fixed", cls: "bg-status-fixed/15 text-green-900 ring-status-fixed/40", Icon: CheckCircle2 },
  }[status];
  const Icon = map.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        map.cls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {map.label}
    </span>
  );
}

export function SourceBadge({ source, className }: { source: Source; className?: string }) {
  const map = {
    quick_report: { label: "Quick report", cls: "bg-accent/15 text-orange-900 ring-accent/40", Icon: Camera },
    council_survey: { label: "Council survey", cls: "bg-slate-200 text-slate-800 ring-slate-300", Icon: ClipboardList },
  }[source];
  const Icon = map.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ring-1",
        map.cls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {map.label}
    </span>
  );
}

export function SyncStatusIndicator({ state, label }: { state: SyncState; label?: string }) {
  const map = {
    queued: { text: label ?? "Queued — will upload when connected", cls: "text-sync-queued", Icon: CloudOff },
    syncing: { text: label ?? "Syncing…", cls: "text-sync-syncing", Icon: Loader2, spin: true },
    uploaded: { text: label ?? "Uploaded", cls: "text-sync-uploaded", Icon: CloudUpload },
    failed: { text: label ?? "Failed — will retry", cls: "text-sync-failed", Icon: RefreshCw },
  }[state];
  const Icon = map.Icon;
  return (
    <div className={cn("inline-flex items-center gap-2 text-sm font-medium", map.cls)}>
      <Icon className={cn("h-4 w-4", "spin" in map && map.spin && "animate-spin")} />
      <span>{map.text}</span>
    </div>
  );
}
