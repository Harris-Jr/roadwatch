import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary, getReports } from "@/lib/api";
import { StatCard } from "@/components/roadwatch/stat-card";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { StatusBadge, SeverityBadge, SourceBadge } from "@/components/roadwatch/badges";
import { AlertTriangle, CheckCircle2, Clock, ClipboardList } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function AdminDashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });
  const { data: potholes = [] } = useQuery({
    queryKey: ["reports", "admin"],
    queryFn: () => getReports({ confirmedOnly: false }),
  });

  const recent = [...potholes]
    .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
    .slice(0, 5);

  const chartData = (summary?.reportsOverTime ?? []).map((row) => ({
    month: MONTH_LABELS[row.month - 1],
    reported: row.reported,
    fixed: row.fixed,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open reports"
          value={summaryLoading ? "…" : (summary?.openReports ?? 0)}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label="In progress"
          value={summaryLoading ? "…" : (summary?.inProgress ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label="Fixed this month"
          value={summaryLoading ? "…" : (summary?.fixedThisMonth ?? 0)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Avg. resolution"
          value={summaryLoading ? "…" : `${summary?.avgResolutionDays ?? 0}d`}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border-2 border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-black">Reports over time</div>
              <div className="text-xs text-muted-foreground">Last 12 months</div>
            </div>
            <div className="flex gap-3 text-xs">
              <Legend cls="bg-status-reported" label="Reported" />
              <Legend cls="bg-status-fixed" label="Fixed" />
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-status-reported)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-status-reported)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-status-fixed)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-status-fixed)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "2px solid var(--color-border)" }} />
                <Area type="monotone" dataKey="reported" stroke="var(--color-status-reported)" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="fixed" stroke="var(--color-status-fixed)" fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border-2 border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-lg font-black">Live map</div>
            <Link to="/admin/map" className="text-xs font-bold text-primary underline">Open full map</Link>
          </div>
          <LeafletMap potholes={potholes.slice(0, 20)} className="h-64 w-full rounded-md border border-border" />
        </div>
      </div>

      <div className="rounded-lg border-2 border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="font-display text-lg font-black">Recent activity</div>
          <Link to="/admin/reports" className="text-sm font-bold text-primary underline">See all reports</Link>
        </div>
        <ul className="divide-y divide-border">
          {recent.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                <div className="truncate font-bold">{p.road}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {p.displayId} · {p.council ?? "Unassigned"} · {new Date(p.reportedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <SeverityBadge level={p.severity} />
                <StatusBadge status={p.status} />
                <SourceBadge source={p.source} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full ${cls}`} />
      <span className="font-semibold">{label}</span>
    </div>
  );
}
