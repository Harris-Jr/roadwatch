export type Severity = "minor" | "moderate" | "severe";
export type Status = "reported" | "in_progress" | "fixed";
export type Source = "quick_report" | "council_survey";
export type SyncState = "queued" | "syncing" | "uploaded" | "failed";
export type UserRole = "individual" | "business" | "government";
export type Plan = "free" | "premium" | "business";

export type RoadCategory =
  | "inter_territorial"
  | "territorial"
  | "district"
  | "branch"
  | "rural"
  | "estate";

export interface Pothole {
  id: string; // real backend report id, as a string — used for routing and API calls
  displayId: string; // "RW-0017", formatted for display only
  road: string;
  roadCategory?: RoadCategory; // undefined when we can't determine it — no fake default
  council?: string;
  severity: Severity;
  status: Status;
  source: Source;
  reportedAt: string;
  updatedAt: string;
  confidence: number;
  photoUrl?: string;
  note?: string;
  confirmed: boolean;
  gps: { lat: number; lng: number };
  // Simplified from the original mock's multi-step fake timeline — we only
  // have reported_at/updated_at/status from the backend, not a full audit
  // log. Add a status_history table later if you want richer timelines.
  timeline: { at: string; label: string; by: string }[];
}

export interface RoadSegment {
  id: number;
  name: string;
  category: RoadCategory;
  responsibleEntity: string;
}

export interface AppUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  plan?: Plan | null;
  organization?: string | null;
}

export interface DashboardSummary {
  openReports: number;
  inProgress: number;
  fixedThisMonth: number;
  avgResolutionDays: number;
  reportsOverTime: { year: number; month: number; reported: number; fixed: number }[];
}

export interface ProcessingJob {
  id: number;
  filename: string;
  status: "queued" | "processing" | "completed" | "failed";
  framesProcessed: number;
  detectionsFound: number;
  uploadedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}

export interface AppSettings {
  minorThreshold: number;
  moderateThreshold: number;
  severeThreshold: number;
  emailDigestTime: string;
  smsForSevereEnabled: boolean;
  dataRetentionDays: number;
}

export interface PlaceResult {
  label: string;
  latitude: number;
  longitude: number;
}

export interface HazardBreakdown {
  minor: number;
  moderate: number;
  severe: number;
  total: number;
  score: number;
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
  lat: number;
  lon: number;
}

export interface RouteOption {
  label: string; // "Safest" | "Balanced" | "Fastest" | "Safest & fastest" | "Alternative"
  geometry: { type: "LineString"; coordinates: [number, number][] }; // [lon, lat] pairs
  distanceKm: number;
  durationMin: number;
  hazards: HazardBreakdown;
  estimated: boolean; // true if OSRM was unreachable — this is a straight-line guess
  steps: RouteStep[];
}

export interface Vehicle {
  id: number;
  name: string;
  plateNumber?: string;
}

export interface Corridor {
  id: number;
  name: string;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}

export interface CorridorRisk {
  corridorId: number;
  name: string;
  distanceKm: number;
  durationMin: number;
  hazards: HazardBreakdown;
  estimated: boolean;
}

export interface BusinessSummary {
  vehicleCount: number;
  corridorCount: number;
  severeHazardsNetworkWide: number;
  repairsThisWeekNetworkWide: number;
}
