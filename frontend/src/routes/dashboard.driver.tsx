import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getReports } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SeverityBadge, StatusBadge } from "@/components/roadwatch/badges";
import { StatCard } from "@/components/roadwatch/stat-card";
import { AlertTriangle, Bell, Crown, Download, MapPin, Route as RouteIcon, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard/driver")({
  component: DriverDashboard,
});

const savedRoutes = [
  { name: "Home → Office", from: "Kabulonga", to: "Cairo Road", hazards: 4 },
  { name: "School run", from: "Woodlands", to: "Longacres", hazards: 2 },
  { name: "Weekend trip", from: "Lusaka", to: "Kafue", hazards: 7 },
];

function DriverDashboard() {
  const { user } = useAuth();
  const tier = user?.plan === "premium" ? "premium" : "free";
  const { data: allReports = [], isLoading } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });
  // Quick Report submissions are anonymous (no login required to file one),
  // so there's no reported_by link yet to filter to "my" reports specifically.
  // Showing recent public activity here until report-to-account linking exists.
  const my = allReports.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-peach px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-ink">
          <Crown className="h-4 w-4 text-primary" />
          <span className="font-semibold">Current plan:</span>
          <span className="font-display font-extrabold capitalize">{tier}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="My reports" value={my.length} tone="primary" />
        <StatCard label="Fixed" value={my.filter((p) => p.status === "fixed").length} tone="success" />
        <StatCard label="Open" value={my.filter((p) => p.status !== "fixed").length} tone="accent" />
      </div>

      {/* My reports */}
      <section className="soft-card overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <div>
            <div className="font-display text-lg font-extrabold text-ink">My reported potholes</div>
            <div className="text-xs text-ink/60">Status and repair timeline</div>
          </div>
          <Link
            to="/report"
            className="hidden h-10 items-center rounded-full bg-primary px-5 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 sm:inline-flex"
            style={{ minHeight: 0 }}
          >
            + New report
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {isLoading && <li className="px-5 py-6 text-sm text-ink/60">Loading…</li>}
          {my.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="truncate font-semibold text-ink">{p.road}</div>
                </div>
                <div className="mt-1 text-xs text-ink/60">
                  {p.displayId} · {p.council ?? "Unassigned"} · {new Date(p.reportedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <SeverityBadge level={p.severity} />
                <StatusBadge status={p.status} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Premium-only */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PremiumCard
          locked={tier === "free"}
          icon={<Bell className="h-5 w-5" />}
          title="Alerts on saved routes"
          body="Get pinged when a new severe pothole appears on any route you drive regularly."
        >
          <ul className="space-y-2">
            {savedRoutes.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between rounded-md border border-border bg-background p-3"
              >
                <div>
                  <div className="text-sm font-bold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.from} → {r.to}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-bold text-severity-severe">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {r.hazards} hazards
                </div>
              </li>
            ))}
          </ul>
        </PremiumCard>

        <PremiumCard
          locked={tier === "free"}
          icon={<RouteIcon className="h-5 w-5" />}
          title="Alternate-route planner"
          body="Suggests detours that avoid moderate and severe potholes on your usual paths."
        >
          <div className="grid gap-2">
            <RouteSuggestion
              a="Cairo Rd via Independence Ave"
              b="Cairo Rd via Church Rd"
              save="Avoids 3 severe"
            />
            <RouteSuggestion
              a="Great East Rd (direct)"
              b="Great East Rd → Addis Ababa Dr"
              save="Avoids 2 moderate"
            />
          </div>
        </PremiumCard>

        <PremiumCard
          locked={tier === "free"}
          icon={<Download className="h-5 w-5" />}
          title="Export history"
          body="Download your full reporting and drive history as CSV for insurance or expenses."
          full
        >
          <button
            disabled={tier === "free"}
            className="btn-pill btn-pill-primary disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV (mock)
          </button>
        </PremiumCard>
      </div>
    </div>
  );
}

function PremiumCard({
  locked,
  icon,
  title,
  body,
  children,
  full,
}: {
  locked: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`relative soft-card p-6 ${full ? "lg:col-span-2" : ""}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <div className="font-display text-base font-extrabold text-ink">{title}</div>
            <div className="text-xs text-ink/60">{body}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-mustard/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">
          <Sparkles className="h-3 w-3" /> Premium
        </span>
      </div>
      <div className={locked ? "pointer-events-none opacity-40 blur-[1px]" : ""}>{children}</div>
      {locked && (
        <div className="absolute inset-0 grid place-items-center rounded-3xl bg-card/70 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink/60">Locked</div>
            <button className="btn-pill btn-pill-primary mt-3">
              Upgrade to Premium
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RouteSuggestion({ a, b, save }: { a: string; b: string; save: string }) {
  return (
    <div className="rounded-2xl bg-peach/60 p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink/60">Original</div>
      <div className="text-sm font-semibold text-ink">{a}</div>
      <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-primary">Suggested</div>
      <div className="text-sm font-semibold text-ink">{b}</div>
      <div className="mt-1 text-[11px] font-bold text-status-fixed">{save}</div>
    </div>
  );
}
