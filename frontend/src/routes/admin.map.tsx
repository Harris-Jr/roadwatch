import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getReports } from "@/lib/api";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { SeverityBadge, StatusBadge, SourceBadge } from "@/components/roadwatch/badges";

export const Route = createFileRoute("/admin/map")({
  component: AdminMap,
});

function AdminMap() {
  const { data: potholes = [], isLoading } = useQuery({
    queryKey: ["reports", "admin"],
    queryFn: () => getReports({ confirmedOnly: false }),
  });
  const [sel, setSel] = useState<string | null>(null);
  const active = potholes.find((p) => p.id === sel);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <LeafletMap
        potholes={potholes}
        selectedId={sel}
        onSelect={setSel}
        className="h-[70vh] w-full rounded-lg border-2 border-border"
      />
      <aside className="rounded-lg border-2 border-border bg-card p-4">
        <div className="mb-2 font-display text-lg font-black">Marker details</div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading reports…</div>
        ) : active ? (
          <>
            <div className="text-sm text-muted-foreground">
              {active.displayId} · {active.council ?? "Unassigned"}
            </div>
            <div className="mt-1 text-lg font-bold">{active.road}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SeverityBadge level={active.severity} />
              <StatusBadge status={active.status} />
              <SourceBadge source={active.source} />
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between border-b border-border/50 py-1">
                <dt className="text-muted-foreground">GPS</dt>
                <dd className="font-mono">{active.gps.lat.toFixed(4)}, {active.gps.lng.toFixed(4)}</dd>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1">
                <dt className="text-muted-foreground">Reported</dt>
                <dd>{new Date(active.reportedAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between border-b border-border/50 py-1 capitalize">
                <dt className="text-muted-foreground">Category</dt>
                <dd>{active.roadCategory ?? "Unclassified"}</dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Click a marker to inspect.</div>
        )}
      </aside>
    </div>
  );
}
