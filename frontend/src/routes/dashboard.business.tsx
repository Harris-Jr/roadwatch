import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  createCorridor,
  createVehicle,
  deleteCorridor,
  deleteVehicle,
  getBusinessSummary,
  getCorridorRisk,
  getCorridors,
  getReports,
  getVehicles,
  searchPlaces,
} from "@/lib/api";
import type { Corridor, PlaceResult } from "@/lib/types";
import { StatCard } from "@/components/roadwatch/stat-card";
import { SeverityBadge } from "@/components/roadwatch/badges";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { Loader2, MapPin, Plus, Route as RouteIcon, Truck, AlertTriangle, X } from "lucide-react";

export const Route = createFileRoute("/dashboard/business")({
  component: BusinessDashboard,
});

const riskTone: Record<string, string> = {
  High: "bg-destructive/10 text-destructive border-destructive/40",
  Moderate: "bg-accent/15 text-accent border-accent/40",
  Low: "bg-status-fixed/15 text-status-fixed border-status-fixed/40",
};

function riskLabel(score: number): "Low" | "Moderate" | "High" {
  if (score >= 6) return "High";
  if (score >= 1) return "Moderate";
  return "Low";
}

function BusinessDashboard() {
  const queryClient = useQueryClient();
  const { data: potholes = [] } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });
  const { data: summary } = useQuery({ queryKey: ["business-summary"], queryFn: getBusinessSummary });
  const { data: vehicles = [] } = useQuery({ queryKey: ["business-vehicles"], queryFn: getVehicles });
  const { data: corridors = [] } = useQuery({ queryKey: ["business-corridors"], queryFn: getCorridors });

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehicleName, setVehicleName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const addVehicle = useMutation({
    mutationFn: () => createVehicle({ name: vehicleName, plateNumber: plateNumber || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["business-summary"] });
      setVehicleName("");
      setPlateNumber("");
      setShowAddVehicle(false);
    },
  });
  const removeVehicle = useMutation({
    mutationFn: (id: number) => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["business-summary"] });
    },
  });

  const [showAddCorridor, setShowAddCorridor] = useState(false);
  const removeCorridor = useMutation({
    mutationFn: (id: number) => deleteCorridor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-corridors"] });
      queryClient.invalidateQueries({ queryKey: ["business-summary"] });
    },
  });

  const severe = potholes.filter((p) => p.severity === "severe").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered vehicles" value={summary?.vehicleCount ?? vehicles.length} tone="primary" icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Corridors monitored" value={summary?.corridorCount ?? corridors.length} tone="accent" />
        <StatCard label="Severe hazards (network)" value={summary?.severeHazardsNetworkWide ?? severe} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Repairs this week (network)" value={summary?.repairsThisWeekNetworkWide ?? 0} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="soft-card overflow-hidden">
          <div className="p-5">
            <div className="font-display text-lg font-extrabold text-ink">Fleet hazard map</div>
            <div className="text-xs text-ink/60">All flagged hazards network-wide</div>
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

      {/* Vehicles */}
      <section className="soft-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5">
          <div>
            <div className="font-display text-lg font-extrabold text-ink">Vehicles</div>
            <div className="text-xs text-ink/60">Registered fleet — real records, not live GPS tracking</div>
          </div>
          <button
            onClick={() => setShowAddVehicle((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
            style={{ minHeight: 0 }}
          >
            <Plus className="h-4 w-4" /> Add vehicle
          </button>
        </div>
        {showAddVehicle && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addVehicle.mutate();
            }}
            className="flex flex-wrap gap-2 border-t border-border/60 p-4"
          >
            <input
              required
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
              placeholder="Vehicle name, e.g. Truck 03"
              className="h-10 flex-1 min-w-[160px] rounded-md border-2 border-border bg-background px-3 text-sm"
            />
            <input
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="Plate number (optional)"
              className="h-10 flex-1 min-w-[140px] rounded-md border-2 border-border bg-background px-3 text-sm"
            />
            <button
              type="submit"
              disabled={addVehicle.isPending}
              className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {addVehicle.isPending ? "Adding…" : "Add"}
            </button>
          </form>
        )}
        <ul className="divide-y divide-border">
          {vehicles.length === 0 && (
            <li className="p-5 text-sm text-muted-foreground">No vehicles registered yet.</li>
          )}
          {vehicles.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 px-5 py-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">{v.name}</div>
                  {v.plateNumber && <div className="text-xs text-muted-foreground">{v.plateNumber}</div>}
                </div>
              </div>
              <button
                onClick={() => removeVehicle.mutate(v.id)}
                className="h-8 rounded-md px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                style={{ minHeight: 32 }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Corridors + real risk */}
      <section className="soft-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5">
          <div>
            <div className="font-display text-lg font-extrabold text-ink">Risk by corridor</div>
            <div className="text-xs text-ink/60">
              Computed live — real route, real hazard count within 60m of the actual road path
            </div>
          </div>
          <button
            onClick={() => setShowAddCorridor((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
            style={{ minHeight: 0 }}
          >
            <Plus className="h-4 w-4" /> Add corridor
          </button>
        </div>

        {showAddCorridor && (
          <AddCorridorForm
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["business-corridors"] });
              queryClient.invalidateQueries({ queryKey: ["business-summary"] });
              setShowAddCorridor(false);
            }}
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-bold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Corridor</th>
                <th className="px-4 py-3 text-right">Distance</th>
                <th className="px-4 py-3 text-right">Moderate</th>
                <th className="px-4 py-3 text-right">Severe</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {corridors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No corridors yet — add one to see real risk scoring.
                  </td>
                </tr>
              )}
              {corridors.map((c) => (
                <CorridorRow key={c.id} corridor={c} onRemove={() => removeCorridor.mutate(c.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CorridorRow({ corridor, onRemove }: { corridor: Corridor; onRemove: () => void }) {
  const { data: risk, isLoading } = useQuery({
    queryKey: ["corridor-risk", corridor.id],
    queryFn: () => getCorridorRisk(corridor.id),
  });

  if (isLoading || !risk) {
    return (
      <tr>
        <td className="px-4 py-3 font-semibold">{corridor.name}</td>
        <td colSpan={4} className="px-4 py-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing route…
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <button onClick={onRemove} className="text-xs font-bold text-destructive hover:underline">Remove</button>
        </td>
      </tr>
    );
  }

  const label = riskLabel(risk.hazards.score);
  return (
    <tr>
      <td className="px-4 py-3 font-semibold">
        {corridor.name}
        {risk.estimated && (
          <span className="ml-1.5 text-[10px] font-normal uppercase text-muted-foreground">(estimated)</span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{risk.distanceKm} km</td>
      <td className="px-4 py-3 text-right tabular-nums">{risk.hazards.moderate}</td>
      <td className="px-4 py-3 text-right tabular-nums font-bold text-severity-severe">{risk.hazards.severe}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${riskTone[label]}`}>
          {label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={onRemove} className="text-xs font-bold text-destructive hover:underline">Remove</button>
      </td>
    </tr>
  );
}

function AddCorridorForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState<PlaceResult | null>(null);
  const [end, setEnd] = useState<PlaceResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createCorridor({
        name,
        startLat: start!.latitude,
        startLon: start!.longitude,
        endLat: end!.latitude,
        endLon: end!.longitude,
      }),
    onSuccess: () => {
      setName("");
      setStart(null);
      setEnd(null);
      onCreated();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (start && end) mutation.mutate();
      }}
      className="space-y-2 border-t border-border/60 p-4"
    >
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Corridor name, e.g. Lusaka → Kafue"
        className="h-10 w-full rounded-md border-2 border-border bg-background px-3 text-sm"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <PlacePicker label="Start point" value={start} onChange={setStart} />
        <PlacePicker label="End point" value={end} onChange={setEnd} />
      </div>
      <button
        type="submit"
        disabled={!start || !end || mutation.isPending}
        className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Adding…" : "Add corridor"}
      </button>
    </form>
  );
}

function PlacePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PlaceResult | null;
  onChange: (p: PlaceResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => setResults(await searchPlaces(query)), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border-2 border-border bg-background px-3">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={value ? value.label : query}
          onChange={(e) => {
            onChange(null);
            setQuery(e.target.value);
          }}
          placeholder={label}
          className="h-10 w-full bg-transparent text-sm outline-none"
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} style={{ minHeight: 0 }}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {!value && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border-2 border-border bg-card shadow-lg">
          {results.map((r, i) => (
            <button
              type="button"
              key={i}
              onClick={() => {
                onChange(r);
                setResults([]);
              }}
              className="block w-full truncate p-2 text-left text-xs hover:bg-muted"
              style={{ minHeight: 0 }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
