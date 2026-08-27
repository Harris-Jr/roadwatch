import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getReport } from "@/lib/api";
import { SeverityBadge, StatusBadge, SourceBadge } from "@/components/roadwatch/badges";
import { ArrowLeft, Camera, MapPin } from "lucide-react";

export const Route = createFileRoute("/pothole/$id")({
  component: PotholeDetail,
  loader: async ({ params }) => {
    try {
      return await getReport(params.id);
    } catch {
      throw notFound();
    }
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <div className="font-display text-3xl font-black">Report not found</div>
        <Link to="/" className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-4 font-bold text-primary-foreground">
          Back to map
        </Link>
      </div>
    </div>
  ),
});

function PotholeDetail() {
  const p = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b-2 border-border bg-card px-4 py-3">
        <Link to="/" className="grid h-11 w-11 place-items-center rounded-md hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-black">{p.road}</div>
          <div className="text-xs text-muted-foreground">{p.displayId}</div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl grid gap-4 p-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-border bg-gradient-to-br from-slate-300 to-slate-500">
            {p.photoUrl ? (
              <img src={p.photoUrl} alt={`Pothole on ${p.road}`} className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-slate-700">
                <Camera className="h-12 w-12 opacity-40" />
              </div>
            )}
            <div className="absolute left-[30%] top-[45%] h-24 w-32 rounded border-2 border-accent shadow-lg">
              <div className="absolute -top-6 left-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                {p.severity.toUpperCase()} · {Math.round(p.confidence * 100)}% conf.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <SeverityBadge level={p.severity} />
            <StatusBadge status={p.status} />
            <SourceBadge source={p.source} />
          </div>

          <div className="rounded-lg border-2 border-border bg-card p-4">
            <div className="mb-3 font-display text-lg font-black">Status timeline</div>
            <ol className="relative space-y-4 border-l-2 border-border pl-6">
              {p.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <div className="absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 border-card bg-primary" />
                  <div className="font-bold">{t.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.at).toLocaleString()} · {t.by}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border-2 border-border bg-card p-4">
            <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Location</div>
            <div className="flex items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              {p.gps.lat.toFixed(5)}, {p.gps.lng.toFixed(5)}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row k="Road" v={p.road} />
              <Row k="Category" v={p.roadCategory?.replace("_", " ") ?? "Unclassified"} />
              <Row k="Assigned to" v={p.council ?? "Unassigned"} />
              <Row k="First detected" v={new Date(p.reportedAt).toLocaleDateString()} />
            </dl>
          </div>
          {p.note && (
            <div className="rounded-lg border-2 border-border bg-card p-4">
              <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Reporter note</div>
              <p className="text-sm">{p.note}</p>
            </div>
          )}
          <div className="rounded-lg border-2 border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Admin actions (status update, assign to council) are available inside the admin dashboard.
            <Link to="/admin" className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-foreground/90 text-sm font-bold text-background">
              Open in admin
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <dt className="font-semibold text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium capitalize">{v}</dd>
    </div>
  );
}
