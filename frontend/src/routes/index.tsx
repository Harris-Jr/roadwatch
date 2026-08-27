import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getReports, getRoadSegments } from "@/lib/api";
import type { Severity, Status } from "@/lib/types";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { SeverityBadge, StatusBadge, SourceBadge } from "@/components/roadwatch/badges";
import { SiteHeader } from "@/components/site/site-header";
import { Camera, Compass, Filter, MapPin, X } from "lucide-react";

export const Route = createFileRoute("/")({
  component: PublicMap,
});

function PublicMap() {
  const { data: potholes = [], isLoading } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });
  const { data: roadSegments = [] } = useQuery({
    queryKey: ["road-segments"],
    queryFn: getRoadSegments,
  });
  const councils = useMemo(
    () => Array.from(new Set(roadSegments.map((s) => s.responsibleEntity))).sort(),
    [roadSegments],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [council, setCouncil] = useState<string>("all");

  const filtered = useMemo(
    () =>
      potholes.filter(
        (p) =>
          (severity === "all" || p.severity === severity) &&
          (status === "all" || p.status === status) &&
          (council === "all" || p.council === council),
      ),
    [potholes, severity, status, council],
  );

  const active = filtered.find((p) => p.id === selected);
  const activeFilterCount =
    (severity !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0) + (council !== "all" ? 1 : 0);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <SiteHeader transparent />

      <div className="relative flex-1 min-h-0">
        <LeafletMap
          potholes={filtered}
          selectedId={selected}
          onSelect={setSelected}
          className="h-full w-full"
        />

        {isLoading && (
          <div className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-card/95 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur">
            Loading reports…
          </div>
        )}

        {/* Filter chip */}
        <button
          onClick={() => setShowFilters(true)}
          className="absolute left-3 top-3 z-[500] inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur hover:bg-card"
          style={{ minHeight: 0 }}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        {showFilters && (
          <>
            <div
              className="absolute inset-0 z-[600] bg-black/30"
              onClick={() => setShowFilters(false)}
            />
            <div className="absolute inset-x-0 bottom-0 z-[700] max-h-[80vh] overflow-y-auto rounded-t-2xl border-t-2 border-border bg-card p-4 shadow-2xl sm:inset-y-0 sm:left-0 sm:right-auto sm:h-full sm:w-80 sm:rounded-none sm:rounded-r-2xl sm:border-r-2 sm:border-t-0">
              <div className="mb-4 flex items-center justify-between">
                <div className="font-display text-lg font-black">Filters</div>
                <button
                  onClick={() => setShowFilters(false)}
                  className="grid h-9 w-9 place-items-center rounded hover:bg-muted"
                  style={{ minHeight: 0 }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <FiltersBody
                severity={severity}
                setSeverity={setSeverity}
                status={status}
                setStatus={setStatus}
                council={council}
                setCouncil={setCouncil}
                councils={councils}
                count={filtered.length}
                total={potholes.length}
              />
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => {
                    setSeverity("all");
                    setStatus("all");
                    setCouncil("all");
                  }}
                  className="h-11 flex-1 rounded-md border-2 border-border bg-card text-sm font-semibold hover:bg-muted"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="h-11 flex-1 rounded-md bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Show {filtered.length}
                </button>
              </div>
            </div>
          </>
        )}

        {active && (
          <div className="absolute inset-x-0 bottom-0 z-[600] max-h-[70vh] overflow-y-auto rounded-t-2xl border-t-2 border-border bg-card p-4 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-96 md:rounded-none md:rounded-l-2xl md:border-l-2 md:border-t-0">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-xl font-black leading-tight">{active.road}</div>
                <div className="text-sm text-muted-foreground">
                  {active.displayId} · {active.council ?? "Unassigned"}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="grid h-10 w-10 place-items-center rounded-md hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {active.photoUrl ? (
              <img
                src={active.photoUrl}
                alt={`Pothole on ${active.road}`}
                className="mb-3 aspect-video w-full rounded-md object-cover"
              />
            ) : (
              <div className="mb-3 flex aspect-video items-center justify-center rounded-md bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700">
                <Camera className="h-8 w-8 opacity-60" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <SeverityBadge level={active.severity} />
              <StatusBadge status={active.status} />
              <SourceBadge source={active.source} />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Reported" v={new Date(active.reportedAt).toLocaleDateString()} />
              <Row k="GPS" v={`${active.gps.lat.toFixed(4)}, ${active.gps.lng.toFixed(4)}`} />
              <Row k="Assigned to" v={active.council ?? "Unassigned"} />
              <Row k="Category" v={active.roadCategory ?? "Unclassified"} />
            </dl>
            {active.note && <p className="mt-3 rounded-md bg-muted p-3 text-sm">{active.note}</p>}
            <Link
              to="/pothole/$id"
              params={{ id: active.id }}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
            >
              View full details
            </Link>
          </div>
        )}

        {/* Compact severity legend */}
        <div className="absolute left-3 bottom-8 z-[500] rounded-md bg-card/80 px-2 py-1 text-[10px] shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <LegendDot cls="bg-severity-minor" label="Minor" />
            <LegendDot cls="bg-severity-moderate" label="Moderate" />
            <LegendDot cls="bg-severity-severe" label="Severe" />
          </div>
        </div>

        {/* Primary CTA: Report a pothole */}
        <Link
          to="/report"
          className="pointer-events-auto absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-[500] inline-flex h-16 -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-8 text-lg font-black text-primary-foreground shadow-2xl ring-4 ring-primary/25 hover:bg-primary/90 active:scale-[0.98]"
          style={{ minHeight: 64 }}
        >
          <Camera className="h-6 w-6" />
          Report a pothole
        </Link>

        {/* Secondary CTA: Navigate */}
        <Link
          to="/navigate"
          className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] right-3 z-[500] inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card/95 px-4 text-sm font-semibold text-foreground shadow-sm backdrop-blur hover:bg-card"
          style={{ minHeight: 0 }}
          aria-label="Plan a route"
        >
          <Compass className="h-4 w-4" />
          <span className="hidden sm:inline">Navigate</span>
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <dt className="font-semibold text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium text-foreground">{v}</dd>
    </div>
  );
}
function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-full border border-white/80 shadow ${cls}`} />
      <span className="font-medium text-foreground/80">{label}</span>
    </div>
  );
}

function FiltersBody(props: {
  severity: Severity | "all";
  setSeverity: (s: Severity | "all") => void;
  status: Status | "all";
  setStatus: (s: Status | "all") => void;
  council: string;
  setCouncil: (s: string) => void;
  councils: string[];
  count: number;
  total: number;
}) {
  const { severity, setSeverity, status, setStatus, council, setCouncil, councils, count, total } = props;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <MapPin className="h-3 w-3" /> Showing {count} of {total}
      </div>
      <FilterGroup
        label="Severity"
        value={severity}
        onChange={(v) => setSeverity(v as Severity | "all")}
        options={[
          { value: "all", label: "All" },
          { value: "minor", label: "Minor" },
          { value: "moderate", label: "Moderate" },
          { value: "severe", label: "Severe" },
        ]}
      />
      <FilterGroup
        label="Status"
        value={status}
        onChange={(v) => setStatus(v as Status | "all")}
        options={[
          { value: "all", label: "All" },
          { value: "reported", label: "Reported" },
          { value: "in_progress", label: "In progress" },
          { value: "fixed", label: "Fixed" },
        ]}
      />
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Council / Area
        </label>
        <select
          value={council}
          onChange={(e) => setCouncil(e.target.value)}
          className="h-11 w-full rounded-md border-2 border-border bg-background px-2 text-sm font-medium"
        >
          <option value="all">All areas</option>
          {councils.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-11 items-center rounded-md border-2 px-3 text-sm font-semibold ${
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
