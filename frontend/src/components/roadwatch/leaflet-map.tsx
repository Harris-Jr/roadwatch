import { lazy, Suspense, useEffect, useState } from "react";
import type { Pothole } from "@/lib/types";

const LeafletMapInner = lazy(() => import("./leaflet-map-inner"));

export function LeafletMap(props: {
  potholes: Pothole[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  routeGeometry?: { type: "LineString"; coordinates: [number, number][] } | null;
  livePosition?: { lat: number; lng: number } | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={props.className}>
      {mounted ? (
        <Suspense fallback={<MapSkeleton />}>
          <LeafletMapInner
            potholes={props.potholes}
            selectedId={props.selectedId}
            onSelect={props.onSelect}
            routeGeometry={props.routeGeometry}
            livePosition={props.livePosition}
          />
        </Suspense>
      ) : (
        <MapSkeleton />
      )}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-200 to-slate-300 text-xs text-muted-foreground">
      Loading map…
    </div>
  );
}
