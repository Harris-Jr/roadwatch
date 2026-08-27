import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getReports } from "@/lib/api";
import { StatCard } from "@/components/roadwatch/stat-card";
import { SeverityBadge } from "@/components/roadwatch/badges";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { Download, Truck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dashboard/business")({
  component: BusinessDashboard,
});

// Fleet/vehicle tracking and per-corridor trip counts aren't backed by any
// endpoint yet — there's no vehicles/corridors data model on the backend.
// This stays mocked until that's built; everything else on this page (the
// map, severe count, latest-severe list) uses real report data below.
const corridors = [
  { corridor: "Lusaka → Kafue (T2)", severe: 6, moderate: 12, trips: 148, risk: "High" },
  { corridor: "Lusaka → Kabwe (T2)", severe: 2, moderate: 9, trips: 96, risk: "Moderate" },
  { corridor: "Great East Rd (Lusaka in-city)", severe: 4, moderate: 7, trips: 210, risk: "High" },
  { corridor: "Ndola → Kitwe", severe: 1, moderate: 5, trips: 62, risk: "Low" },
  { corridor: "Mumbwa Rd corridor", severe: 3, moderate: 8, trips: 74, risk: "Moderate" },
];

const riskTone: Record<string, string> = {
  High: "bg-destructive/10 text-destructive border-destructive/40",
  Moderate: "bg-accent/15 text-accent border-accent/40",
  Low: "bg-status-fixed/15 text-status-fixed border-status-fixed/40",
};

function BusinessDashboard() {
  const { data: potholes = [] } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });
  const severe = potholes.filter((p) => p.severity === "severe").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active vehicles" value="—" tone="primary" icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Corridors monitored" value={corridors.length} tone="accent" />
        <StatCard label="Severe hazards" value={severe} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Repairs this week" value="—" tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="soft-card overflow-hidden">
          <div className="p-5">
            <div className="font-display text-lg font-extrabold text-ink">Fleet hazard map</div>
            <div className="text-xs text-ink/60">
              All flagged hazards across your saved corridors
            </div>
          </div>
          <div className="h-[420px]">
            <LeafletMap potholes={potholes} className="h-full w-full" />
          </div>
        </section>

        <section className="soft-card overflow-hidden">
          <div className="p-5">
            <div className="font-display text-lg font-extrabold text-ink">Latest severe</div>
            <div className="text-xs text-ink/60">Sorted by report date</div>
          </div>
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {potholes
              .filter((p) => p.severity === "severe")
              .slice(0, 10)
              .map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink">{p.road}</div>
                    <div className="truncate text-xs text-ink/60">
                      {p.council ?? "Unassigned"} · {new Date(p.reportedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <SeverityBadge level={p.severity} />
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className="soft-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5">
          <div>
            <div className="font-display text-lg font-extrabold text-ink">Risk by corridor</div>
            <div className="text-xs text-ink/60">Rolling 30 days</div>
          </div>
          <button className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90" style={{ minHeight: 0 }}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-bold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Corridor</th>
                <th className="px-4 py-3 text-right">Trips</th>
                <th className="px-4 py-3 text-right">Moderate</th>
                <th className="px-4 py-3 text-right">Severe</th>
                <th className="px-4 py-3">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {corridors.map((c) => (
                <tr key={c.corridor}>
                  <td className="px-4 py-3 font-semibold">{c.corridor}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.trips}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.moderate}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-severity-severe">
                    {c.severe}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${riskTone[c.risk]}`}
                    >
                      {c.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
