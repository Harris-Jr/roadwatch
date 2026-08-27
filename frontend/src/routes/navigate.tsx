import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Circle,
  Compass,
  MapPin,
  Navigation,
  Shield,
  X,
} from "lucide-react";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { useQuery } from "@tanstack/react-query";
import { getReports } from "@/lib/api";

export const Route = createFileRoute("/navigate")({
  head: () => ({
    meta: [
      { title: "Navigate — RoadWatch Zambia" },
      { name: "description", content: "Plan a route across Zambian roads with pothole-aware alternatives." },
    ],
  }),
  component: NavigateFlow,
});

type Step = 1 | 2 | 3;

type Option = {
  id: string;
  label: string;
  eta: string;
  distance: string;
  hazards: number;
  risk: "low" | "medium" | "high";
  tag?: string;
};

// Route ETAs, distances, and hazard counts below are simulated — there's no
// routing engine (OSRM/GraphHopper/Valhalla) wired up yet to compute real
// pothole-aware routes. The map background now shows real report data; the
// route options themselves are still illustrative.
const OPTIONS: Option[] = [
  { id: "safe", label: "Safest", eta: "24 min", distance: "9.4 km", hazards: 2, risk: "low", tag: "Fewest potholes" },
  { id: "balanced", label: "Balanced", eta: "19 min", distance: "8.1 km", hazards: 5, risk: "medium", tag: "Recommended" },
  { id: "fast", label: "Fastest", eta: "16 min", distance: "7.6 km", hazards: 9, risk: "high" },
];

const SAMPLES = ["Cairo Road", "Great East Road", "Kafue Road", "Independence Avenue", "Lumumba Road"];

function NavigateFlow() {
  const [step, setStep] = useState<Step>(1);
  const [from, setFrom] = useState("Current location");
  const [to, setTo] = useState("");
  const [pick, setPick] = useState<Option["id"]>("balanced");

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link to="/" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="font-display text-base font-black">Navigate</div>
        <div className="ml-auto text-xs font-semibold text-muted-foreground">Step {step} of 3</div>
      </header>

      {step === 1 && (
        <SearchStep from={from} setFrom={setFrom} to={to} setTo={setTo} onNext={() => to.trim() && setStep(2)} />
      )}
      {step === 2 && (
        <RouteStep
          from={from}
          to={to}
          pick={pick}
          setPick={setPick}
          onBack={() => setStep(1)}
          onStart={() => setStep(3)}
        />
      )}
      {step === 3 && <ActiveNavStep to={to} pick={pick} onEnd={() => setStep(1)} />}
    </div>
  );
}

function SearchStep({
  from,
  setFrom,
  to,
  setTo,
  onNext,
}: {
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="soft-card p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink/60">
          <Compass className="h-3.5 w-3.5" /> Plan your trip
        </div>

        <div className="space-y-2">
          <FieldRow icon={<Circle className="h-4 w-4 fill-primary text-primary" />} label="From">
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
            />
          </FieldRow>
          <FieldRow icon={<MapPin className="h-4 w-4 text-accent" />} label="To">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Search a road or destination"
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink/40"
            />
          </FieldRow>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink/60">Suggestions</div>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              onClick={() => setTo(s)}
              className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-ink hover:bg-peach"
              style={{ minHeight: 0 }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!to.trim()}
        className="btn-pill btn-pill-primary mt-4 inline-flex w-full items-center justify-center gap-2 text-base disabled:opacity-50"
      >
        Find routes <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FieldRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-card">{icon}</div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink/50">{label}</div>
        {children}
      </div>
    </div>
  );
}

function RouteStep({
  from,
  to,
  pick,
  setPick,
  onBack,
  onStart,
}: {
  from: string;
  to: string;
  pick: string;
  setPick: (v: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const { data: potholes = [] } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });
  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col">
      <div className="relative h-72 shrink-0">
        <LeafletMap potholes={potholes.slice(0, 10)} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-3 top-3 rounded-2xl bg-card/95 p-3 shadow-md backdrop-blur">
          <div className="flex items-center gap-2 text-xs">
            <Circle className="h-3 w-3 fill-primary text-primary" />
            <span className="truncate font-semibold text-ink">{from}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <MapPin className="h-3 w-3 text-accent" />
            <span className="truncate font-semibold text-ink">{to}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pb-24 pt-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink/60">Choose a route</div>
        {OPTIONS.map((o) => {
          const active = pick === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setPick(o.id)}
              className={`w-full rounded-3xl p-4 text-left transition-colors ${
                active ? "bg-teal/30 ring-2 ring-primary" : "soft-card hover:bg-peach/40"
              }`}
              style={{ minHeight: 0 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg font-extrabold text-ink">{o.label}</div>
                    {o.tag && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        {o.tag}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-ink/70">
                    {o.eta} · {o.distance}
                  </div>
                </div>
                <RiskBadge risk={o.risk} count={o.hazards} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="btn-pill inline-flex items-center gap-2 bg-muted text-ink hover:bg-peach"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={onStart}
          className="btn-pill btn-pill-primary inline-flex flex-1 items-center justify-center gap-2"
        >
          <Navigation className="h-4 w-4" /> Start navigation
        </button>
      </div>
    </div>
  );
}

function RiskBadge({ risk, count }: { risk: "low" | "medium" | "high"; count: number }) {
  const cfg = {
    low: { bg: "bg-severity-minor/20 text-ink", icon: <Shield className="h-3.5 w-3.5" /> },
    medium: { bg: "bg-severity-moderate/25 text-ink", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    high: { bg: "bg-severity-severe/25 text-ink", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  }[risk];
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${cfg.bg}`}>
      {cfg.icon}
      {count} hazards
    </div>
  );
}

function ActiveNavStep({ to, pick, onEnd }: { to: string; pick: string; onEnd: () => void }) {
  const chosen = OPTIONS.find((o) => o.id === pick)!;
  const { data: potholes = [] } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <LeafletMap potholes={potholes.slice(0, 12)} className="absolute inset-0" />

      {/* Top: next-turn instruction */}
      <div className="pointer-events-auto absolute inset-x-3 top-3 rounded-3xl bg-primary p-4 text-primary-foreground shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
            <Navigation className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">In 300 m</div>
            <div className="truncate font-display text-lg font-black leading-tight">
              Turn right onto {to}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: ETA, remaining distance, End */}
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-3xl bg-card p-3 shadow-2xl">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
            ETA · {chosen.label}
          </div>
          <div className="font-display text-2xl font-black leading-none text-ink">
            {chosen.eta}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-ink/70">
            {chosen.distance} remaining
          </div>
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-destructive px-4 text-xs font-black uppercase tracking-wider text-destructive-foreground shadow-md hover:opacity-90"
          style={{ minHeight: 0 }}
          aria-label="End navigation"
        >
          <X className="h-3.5 w-3.5" /> End
        </button>
      </div>
    </div>
  );
}
