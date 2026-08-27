import { Link } from "@tanstack/react-router";
import type { Pothole } from "@/lib/types";
import { SeverityBadge, StatusBadge, SourceBadge } from "./badges";
import { Calendar, MapPin } from "lucide-react";

export function PotholeCard({ p, compact }: { p: Pothole; compact?: boolean }) {
  return (
    <div className="rounded-lg border-2 border-border bg-card p-4 shadow-sm">
      {!compact && (
        <div className="mb-3 flex aspect-video items-center justify-center rounded-md bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500">
          <span className="text-xs">Photo preview</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge level={p.severity} />
        <StatusBadge status={p.status} />
        <SourceBadge source={p.source} />
      </div>
      <div className="mt-3 space-y-1">
        <div className="font-bold text-foreground">{p.road}</div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {p.gps.lat.toFixed(4)}, {p.gps.lng.toFixed(4)} · {p.council}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(p.reportedAt).toLocaleDateString()}
        </div>
      </div>
      {p.note && <p className="mt-3 rounded-md bg-muted p-2 text-sm">{p.note}</p>}
      <Link
        to="/pothole/$id"
        params={{ id: p.id }}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        View full details
      </Link>
    </div>
  );
}
