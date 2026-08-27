import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getReports, updateReport } from "@/lib/api";
import type { Severity, Status, Source, Pothole } from "@/lib/types";
import { SeverityBadge, StatusBadge, SourceBadge } from "@/components/roadwatch/badges";
import { ArrowUpDown, Search, X } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

type SortKey = "displayId" | "road" | "severity" | "status" | "source" | "reportedAt" | "council";

function AdminReports() {
  const { data: potholes = [], isLoading } = useQuery({
    queryKey: ["reports", "admin"],
    queryFn: () => getReports({ confirmedOnly: false }),
  });

  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [source, setSource] = useState<Source | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "reportedAt", dir: "desc" });
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = useMemo(() => {
    const rows = potholes.filter(
      (p) =>
        (severity === "all" || p.severity === severity) &&
        (status === "all" || p.status === status) &&
        (source === "all" || p.source === source) &&
        (q === "" ||
          p.road.toLowerCase().includes(q.toLowerCase()) ||
          p.displayId.toLowerCase().includes(q.toLowerCase()) ||
          (p.council ?? "").toLowerCase().includes(q.toLowerCase())),
    );
    rows.sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [potholes, q, severity, status, source, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);
  const active = potholes.find((p) => p.id === selected);

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-border bg-card p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search road, ID, or council…"
            className="h-11 w-full rounded-md border-2 border-border bg-background pl-9 pr-3 text-sm font-medium"
          />
        </div>
        <Select label="Severity" value={severity} onChange={(v) => setSeverity(v as Severity | "all")} opts={["all", "minor", "moderate", "severe"]} />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as Status | "all")} opts={["all", "reported", "in_progress", "fixed"]} />
        <Select label="Source" value={source} onChange={(v) => setSource(v as Source | "all")} opts={["all", "quick_report", "council_survey"]} />
      </div>

      {isLoading ? (
        <div className="rounded-lg border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Loading reports…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border-2 border-border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/70 text-xs font-bold uppercase text-muted-foreground">
              <tr>
                <Th onClick={() => setSortKey("displayId")}>ID</Th>
                <Th onClick={() => setSortKey("road")}>Road</Th>
                <Th onClick={() => setSortKey("severity")}>Severity</Th>
                <Th onClick={() => setSortKey("status")}>Status</Th>
                <Th onClick={() => setSortKey("source")}>Source</Th>
                <Th onClick={() => setSortKey("reportedAt")}>Date</Th>
                <Th onClick={() => setSortKey("council")}>Assigned</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className="cursor-pointer border-t border-border hover:bg-muted/40"
                >
                  <td className="p-3 font-mono text-xs font-bold">{p.displayId}</td>
                  <td className="p-3 font-semibold">{p.road}</td>
                  <td className="p-3"><SeverityBadge level={p.severity} /></td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3"><SourceBadge source={p.source} /></td>
                  <td className="p-3 whitespace-nowrap">{new Date(p.reportedAt).toLocaleDateString()}</td>
                  <td className="p-3">{p.council ?? "Unassigned"}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No reports match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {filtered.length > 0
            ? `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, filtered.length)} of ${filtered.length}`
            : "No results"}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-10 rounded-md border-2 border-border bg-card px-3 font-semibold hover:bg-muted disabled:opacity-40"
            style={{ minHeight: 40 }}
          >
            Prev
          </button>
          <div className="px-2 font-semibold">Page {page} / {pages}</div>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="h-10 rounded-md border-2 border-border bg-card px-3 font-semibold hover:bg-muted disabled:opacity-40"
            style={{ minHeight: 40 }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Drawer */}
      {active && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-xl font-black">{active.road}</div>
                <div className="text-xs text-muted-foreground">{active.displayId} · {active.council ?? "Unassigned"}</div>
              </div>
              <button onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <SeverityBadge level={active.severity} />
              <StatusBadge status={active.status} />
              <SourceBadge source={active.source} />
            </div>
            {active.photoUrl ? (
              <img src={active.photoUrl} alt="" className="mb-3 aspect-video w-full rounded-md object-cover" />
            ) : (
              <div className="mb-3 aspect-video rounded-md bg-gradient-to-br from-slate-300 to-slate-500" />
            )}

            <DrawerEditor key={active.id} report={active} onClose={() => setSelected(null)} />
          </aside>
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "reported", label: "Reported" },
  { value: "in_progress", label: "In progress" },
  { value: "fixed", label: "Fixed" },
];

const COUNCIL_OPTIONS = ["RDA", "Lusaka City Council", "Kitwe City Council", "Ndola City Council"];

function DrawerEditor({ report, onClose }: { report: Pothole; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>(report.status);
  const councilOptions = report.council && !COUNCIL_OPTIONS.includes(report.council)
    ? [report.council, ...COUNCIL_OPTIONS]
    : COUNCIL_OPTIONS;
  const [council, setCouncil] = useState<string>(report.council ?? COUNCIL_OPTIONS[0]);

  const mutation = useMutation({
    mutationFn: () => updateReport(report.id, { status, assignedCouncil: council }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
  });

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div>
        <label className="block text-xs font-bold uppercase text-muted-foreground">Update status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="mt-1 h-11 w-full rounded-md border-2 border-border bg-card px-2 text-sm font-semibold"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-muted-foreground">Assign to council</label>
        <select
          value={council}
          onChange={(e) => setCouncil(e.target.value)}
          className="mt-1 h-11 w-full rounded-md border-2 border-border bg-card px-2 text-sm font-semibold"
        >
          {councilOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {mutation.isError && (
        <div className="text-xs text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Couldn't save changes."}
        </div>
      )}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary font-bold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th className="p-3 text-left">
      <button onClick={onClick} className="inline-flex items-center gap-1 font-bold uppercase hover:text-foreground" style={{ minHeight: 0 }}>
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}

function Select({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="font-bold uppercase text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border-2 border-border bg-background px-2 text-sm font-semibold capitalize"
      >
        {opts.map((o) => (
          <option key={o} value={o}>{o.replace("_", " ")}</option>
        ))}
      </select>
    </label>
  );
}
