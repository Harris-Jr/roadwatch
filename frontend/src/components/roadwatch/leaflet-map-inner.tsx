import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { Pothole } from "@/lib/types";

const severityColor = {
  minor: "#eab308",
  moderate: "#f97316",
  severe: "#dc2626",
} as const;

function makeIcon(severity: Pothole["severity"], active: boolean) {
  const size = active ? 22 : 16;
  const color = severityColor[severity];
  return L.divIcon({
    className: "rw-pothole-marker",
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:9999px;
      background:${color};border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.35)${active ? ",0 0 0 4px rgba(21,128,61,.35)" : ""};
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const liveIcon = L.divIcon({
  className: "rw-live-marker",
  html: `<span style="
    display:block;width:18px;height:18px;border-radius:9999px;
    background:#1B3D33;border:3px solid #fff;
    box-shadow:0 0 0 6px rgba(27,61,51,.25),0 2px 8px rgba(0,0,0,.4);
  "></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FlyTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
}

export default function LeafletMapInner({
  potholes,
  selectedId,
  onSelect,
  routeGeometry,
  livePosition,
}: {
  potholes: Pothole[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  // GeoJSON LineString coordinates, [lon, lat] pairs — matches what the
  // backend/OSRM returns directly, converted to [lat, lon] for Leaflet here.
  routeGeometry?: { type: "LineString"; coordinates: [number, number][] } | null;
  livePosition?: { lat: number; lng: number } | null;
}) {
  const active = potholes.find((p) => p.id === selectedId);
  const routeLatLngs: [number, number][] =
    routeGeometry?.coordinates.map(([lon, lat]) => [lat, lon]) ?? [];

  return (
    <MapContainer
      center={[-15.3875, 28.3228]}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      attributionControl
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="topright" />
      {routeLatLngs.length > 1 && (
        <>
          <Polyline positions={routeLatLngs} pathOptions={{ color: "#1B3D33", weight: 5, opacity: 0.85 }} />
          <FitBounds positions={routeLatLngs} />
        </>
      )}
      {livePosition && <Marker position={[livePosition.lat, livePosition.lng]} icon={liveIcon} />}
      {potholes.map((p) => (
        <Marker
          key={p.id}
          position={[p.gps.lat, p.gps.lng]}
          icon={makeIcon(p.severity, p.id === selectedId)}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
        >
          <Popup>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontWeight: 700 }}>{p.road}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {p.displayId} · {p.severity}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      <FlyTo lat={active?.gps.lat ?? null} lng={active?.gps.lng ?? null} />
    </MapContainer>
  );
}
