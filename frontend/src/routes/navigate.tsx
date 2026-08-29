import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Circle,
  Compass,
  Loader2,
  MapPin,
  Navigation,
  Shield,
  X,
} from "lucide-react";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { getRouteOptions, searchPlaces } from "@/lib/api";
import type { PlaceResult, RouteOption } from "@/lib/types";

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
type LatLng = { lat: number; lng: number };

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function NavigateFlow() {
  const [step, setStep] = useState<Step>(1);
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [fromLabel, setFromLabel] = useState("Locating you…");
  const [locError, setLocError] = useState<string | null>(null);
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [pickIndex, setPickIndex] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError("This browser doesn't support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFromCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setFromLabel("Current location");
      },
      () => setLocError("Couldn't get your location — enable location access to plan a route."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const routeMutation = useMutation({
    mutationFn: () =>
      getRouteOptions({
        fromLat: fromCoords!.lat,
        fromLon: fromCoords!.lng,
        toLat: destination!.latitude,
        toLon: destination!.longitude,
      }),
    onSuccess: (data) => {
      setRoutes(data);
      setPickIndex(0);
      setStep(2);
    },
  });

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
        <SearchStep
          fromLabel={fromLabel}
          locError={locError}
          destination={destination}
          setDestination={setDestination}
          onNext={() => fromCoords && destination && routeMutation.mutate()}
          loading={routeMutation.isPending}
          error={routeMutation.isError ? "Couldn't compute a route. Try again." : null}
          canGo={!!fromCoords && !!destination}
        />
      )}
      {step === 2 && (
        <RouteStep
          fromLabel={fromLabel}
          destinationLabel={destination?.label ?? ""}
          routes={routes}
          pickIndex={pickIndex}
          setPickIndex={setPickIndex}
          onBack={() => setStep(1)}
          onStart={() => setStep(3)}
        />
      )}
      {step === 3 && fromCoords && destination && (
        <ActiveNavStep
          route={routes[pickIndex]}
          destination={destination}
          onEnd={() => setStep(1)}
        />
      )}
    </div>
  );
}

function SearchStep({
  fromLabel,
  locError,
  destination,
  setDestination,
  onNext,
  loading,
  error,
  canGo,
}: {
  fromLabel: string;
  locError: string | null;
  destination: PlaceResult | null;
  setDestination: (p: PlaceResult | null) => void;
  onNext: () => void;
  loading: boolean;
  error: string | null;
  canGo: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(query);
        setResults(found);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="soft-card p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink/60">
          <Compass className="h-3.5 w-3.5" /> Plan your trip
        </div>

        <div className="space-y-2">
          <FieldRow icon={<Circle className="h-4 w-4 fill-primary text-primary" />} label="From">
            <span className="block text-sm font-semibold text-ink">{fromLabel}</span>
            {locError && <span className="text-xs text-destructive">{locError}</span>}
          </FieldRow>
          <FieldRow icon={<MapPin className="h-4 w-4 text-accent" />} label="To">
            <input
              value={destination ? destination.label : query}
              onChange={(e) => {
                setDestination(null);
                setQuery(e.target.value);
              }}
              placeholder="Search a road or destination in Zambia"
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink/40"
            />
          </FieldRow>
        </div>
      </div>

      {!destination && query.trim().length >= 2 && (
        <div className="soft-card divide-y divide-border/60 overflow-hidden">
          {searching && (
            <div className="flex items-center gap-2 p-3 text-xs text-ink/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!searching && results.length === 0 && (
            <div className="p-3 text-xs text-ink/60">No matches — try a different search.</div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                setDestination(r);
                setQuery("");
                setResults([]);
              }}
              className="flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-muted"
              style={{ minHeight: 0 }}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="text-ink">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="rounded-2xl bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

      <button
        onClick={onNext}
        disabled={!canGo || loading}
        className="btn-pill btn-pill-primary mt-4 inline-flex w-full items-center justify-center gap-2 text-base disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Computing routes…
          </>
        ) : (
          <>
            Find routes <ArrowRight className="h-4 w-4" />
          </>
        )}
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
  fromLabel,
  destinationLabel,
  routes,
  pickIndex,
  setPickIndex,
  onBack,
  onStart,
}: {
  fromLabel: string;
  destinationLabel: string;
  routes: RouteOption[];
  pickIndex: number;
  setPickIndex: (i: number) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const picked = routes[pickIndex];
  const anyEstimated = routes.some((r) => r.estimated);

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col">
      <div className="relative h-72 shrink-0">
        <LeafletMap potholes={[]} routeGeometry={picked?.geometry ?? null} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-3 top-3 rounded-2xl bg-card/95 p-3 shadow-md backdrop-blur">
          <div className="flex items-center gap-2 text-xs">
            <Circle className="h-3 w-3 fill-primary text-primary" />
            <span className="truncate font-semibold text-ink">{fromLabel}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <MapPin className="h-3 w-3 text-accent" />
            <span className="truncate font-semibold text-ink">{destinationLabel}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pb-24 pt-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink/60">Choose a route</div>
        {anyEstimated && (
          <div className="rounded-2xl bg-accent/15 p-3 text-xs text-ink/80">
            Approximate — the routing engine isn't fully set up yet, so this is a straight-line
            estimate rather than a real road-following route.
          </div>
        )}
        {routes.map((o, i) => {
          const active = i === pickIndex;
          const risk = o.hazards.severe > 0 ? "high" : o.hazards.moderate > 0 ? "medium" : "low";
          return (
            <button
              key={i}
              onClick={() => setPickIndex(i)}
              className={`w-full rounded-3xl p-4 text-left transition-colors ${
                active ? "bg-teal/30 ring-2 ring-primary" : "soft-card hover:bg-peach/40"
              }`}
              style={{ minHeight: 0 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg font-extrabold text-ink">{o.label}</div>
                  </div>
                  <div className="mt-1 text-xs text-ink/70">
                    {o.durationMin} min · {o.distanceKm} km
                  </div>
                </div>
                <RiskBadge risk={risk} count={o.hazards.total} />
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
          disabled={!picked}
          className="btn-pill btn-pill-primary inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
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

function ActiveNavStep({
  route,
  destination,
  onEnd,
}: {
  route: RouteOption;
  destination: PlaceResult;
  onEnd: () => void;
}) {
  const [livePos, setLivePos] = useState<LatLng | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setLivePos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const remainingKm = useMemo(() => {
    if (!livePos) return route.distanceKm;
    return Math.max(0, haversineKm(livePos, { lat: destination.latitude, lng: destination.longitude }));
  }, [livePos, route.distanceKm, destination]);

  // Real next-turn instruction: the step whose maneuver point is closest
  // ahead of the driver's live position, based on actual OSRM maneuver
  // data — not a fixed string.
  const nextStep = useMemo(() => {
    if (route.steps.length === 0) return null;
    if (!livePos) return route.steps[0];
    let closest = route.steps[0];
    let closestDist = Infinity;
    for (const s of route.steps) {
      const d = haversineKm(livePos, { lat: s.lat, lng: s.lon });
      if (d < closestDist) {
        closestDist = d;
        closest = s;
      }
    }
    return closest;
  }, [route.steps, livePos]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <LeafletMap
        potholes={[]}
        routeGeometry={route.geometry}
        livePosition={livePos}
        className="absolute inset-0"
      />

      <div className="pointer-events-auto absolute inset-x-3 top-3 rounded-3xl bg-primary p-4 text-primary-foreground shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
            <Navigation className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">
              {route.estimated ? "Estimated route" : "Next"}
            </div>
            <div className="truncate font-display text-lg font-black leading-tight">
              {nextStep?.instruction ?? "Continue"}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-3xl bg-card p-3 shadow-2xl">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
            {route.label} {!livePos && "· waiting for GPS"}
          </div>
          <div className="font-display text-2xl font-black leading-none text-ink">
            {remainingKm.toFixed(1)} km
          </div>
          <div className="mt-0.5 text-xs font-semibold text-ink/70">remaining to destination</div>
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
