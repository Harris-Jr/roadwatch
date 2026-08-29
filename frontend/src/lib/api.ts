import type {
  AppSettings,
  AppUser,
  BusinessSummary,
  Corridor,
  CorridorRisk,
  DashboardSummary,
  HazardBreakdown,
  Plan,
  PlaceResult,
  Pothole,
  ProcessingJob,
  RoadCategory,
  RoadSegment,
  RouteOption,
  Severity,
  Status,
  Source,
  UserRole,
  Vehicle,
} from "./types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const AUTH_STORAGE_KEY = "roadwatch_auth";

export interface StoredAuth {
  token: string;
  user: AppUser;
}

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    const stored = getStoredAuth();
    if (stored) headers.set("Authorization", `Bearer ${stored.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// --- transforms: backend snake_case wire shape -> frontend camelCase types ---

function mapReport(r: any): Pothole {
  const timeline: Pothole["timeline"] = [
    {
      at: r.reported_at,
      label: "Reported",
      by: r.source === "council_survey" ? "Council survey" : "Public",
    },
  ];
  if (r.status !== "reported") {
    timeline.push({
      at: r.updated_at,
      label: r.status === "in_progress" ? "In progress" : "Marked fixed",
      by: r.assigned_council ?? "Admin",
    });
  }

  return {
    id: String(r.id),
    displayId: `RW-${String(r.id).padStart(4, "0")}`,
    road: r.road_name,
    council: r.assigned_council ?? undefined,
    severity: r.severity,
    status: r.status,
    source: r.source,
    reportedAt: r.reported_at,
    updatedAt: r.updated_at,
    confidence: r.confidence,
    photoUrl: r.photo_url ? `${API_URL}/uploads/${r.photo_url}` : undefined,
    note: r.note ?? undefined,
    confirmed: r.confirmed,
    gps: { lat: r.latitude, lng: r.longitude },
    timeline,
  };
}

function mapUser(u: any): AppUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    plan: u.plan ?? null,
    organization: u.organization ?? null,
  };
}

function mapRoadSegment(s: any): RoadSegment {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    responsibleEntity: s.responsible_entity,
  };
}

function mapJob(j: any): ProcessingJob {
  return {
    id: j.id,
    filename: j.filename,
    status: j.status,
    framesProcessed: j.frames_processed,
    detectionsFound: j.detections_found,
    uploadedAt: j.uploaded_at,
    completedAt: j.completed_at,
    errorMessage: j.error_message,
  };
}

function mapSettings(s: any): AppSettings {
  return {
    minorThreshold: s.minor_threshold,
    moderateThreshold: s.moderate_threshold,
    severeThreshold: s.severe_threshold,
    emailDigestTime: s.email_digest_time,
    smsForSevereEnabled: s.sms_for_severe_enabled,
    dataRetentionDays: s.data_retention_days,
  };
}

// --- auth ---

export async function login(email: string, password: string): Promise<StoredAuth> {
  const data = await request<any>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    auth: false,
  });
  return { token: data.access_token, user: mapUser(data.user) };
}

export async function signup(payload: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  plan?: Plan;
  organization?: string;
}): Promise<StoredAuth> {
  const data = await request<any>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      full_name: payload.fullName,
      role: payload.role,
      plan: payload.plan,
      organization: payload.organization,
    }),
    auth: false,
  });
  return { token: data.access_token, user: mapUser(data.user) };
}

export async function fetchMe(): Promise<AppUser> {
  const data = await request<any>("/auth/me");
  return mapUser(data);
}

// --- reports ---

export interface ReportFilters {
  severity?: Severity;
  statusFilter?: Status;
  source?: Source;
  council?: string;
  confirmedOnly?: boolean;
}

export async function getReports(filters: ReportFilters = {}): Promise<Pothole[]> {
  const params = new URLSearchParams();
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.statusFilter) params.set("status_filter", filters.statusFilter);
  if (filters.source) params.set("source", filters.source);
  if (filters.council) params.set("council", filters.council);
  params.set("confirmed_only", String(filters.confirmedOnly ?? true));

  const data = await request<any[]>(`/reports?${params.toString()}`, { auth: false });
  return data.map(mapReport);
}

export async function getReport(id: string): Promise<Pothole> {
  const data = await request<any>(`/reports/${id}`, { auth: false });
  return mapReport(data);
}

export async function submitQuickReport(input: {
  photo?: File;
  video?: File;
  latitude?: number;
  longitude?: number;
  severity?: Severity;
  note?: string;
}): Promise<Pothole> {
  if (!input.photo && !input.video) {
    throw new ApiError(400, "Attach a photo or a short video clip.");
  }
  const form = new FormData();
  if (input.photo) form.set("photo", input.photo);
  if (input.video) form.set("video", input.video);
  if (input.latitude !== undefined) form.set("latitude", String(input.latitude));
  if (input.longitude !== undefined) form.set("longitude", String(input.longitude));
  if (input.severity) form.set("severity", input.severity);
  if (input.note) form.set("note", input.note);

  const data = await request<any>("/reports/quick-report", {
    method: "POST",
    body: form,
    auth: false,
  });
  return mapReport(data);
}

export async function updateReport(
  id: string,
  payload: { status?: Status; assignedCouncil?: string },
): Promise<Pothole> {
  const data = await request<any>(`/reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: payload.status,
      assigned_council: payload.assignedCouncil,
    }),
  });
  return mapReport(data);
}

export async function confirmReport(id: string): Promise<Pothole> {
  const data = await request<any>(`/reports/${id}/confirm`, { method: "POST" });
  return mapReport(data);
}

export async function rejectReport(id: string): Promise<void> {
  await request<void>(`/reports/${id}`, { method: "DELETE" });
}

// --- road segments ---

export async function getRoadSegments(): Promise<RoadSegment[]> {
  const data = await request<any[]>("/road-segments", { auth: false });
  return data.map(mapRoadSegment);
}

export async function createRoadSegment(payload: {
  name: string;
  category: RoadCategory;
  responsibleEntity: string;
}): Promise<RoadSegment> {
  const data = await request<any>("/road-segments", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      category: payload.category,
      responsible_entity: payload.responsibleEntity,
    }),
  });
  return mapRoadSegment(data);
}

export async function deleteRoadSegment(id: number): Promise<void> {
  await request<void>(`/road-segments/${id}`, { method: "DELETE" });
}

// --- users ---

export async function getUsers(): Promise<AppUser[]> {
  const data = await request<any[]>("/users");
  return data.map(mapUser);
}

// --- uploads / video processing ---

export async function uploadVideo(video: File, gpsLog?: File): Promise<ProcessingJob> {
  const form = new FormData();
  form.set("video", video);
  if (gpsLog) form.set("gps_log", gpsLog);
  const data = await request<any>("/uploads/video", { method: "POST", body: form });
  return mapJob(data);
}

export async function getJobs(): Promise<ProcessingJob[]> {
  const data = await request<any[]>("/uploads/jobs");
  return data.map(mapJob);
}

export async function getJobDetections(jobId: number): Promise<Pothole[]> {
  const data = await request<any[]>(`/uploads/jobs/${jobId}/detections`);
  return data.map(mapReport);
}

// --- dashboard ---

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const data = await request<any>("/dashboard/summary");
  return {
    openReports: data.open_reports,
    inProgress: data.in_progress,
    fixedThisMonth: data.fixed_this_month,
    avgResolutionDays: data.avg_resolution_days,
    reportsOverTime: data.reports_over_time,
  };
}

// --- settings ---

export async function getSettings(): Promise<AppSettings> {
  const data = await request<any>("/settings", { auth: false });
  return mapSettings(data);
}

export async function updateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const data = await request<any>("/settings", {
    method: "PATCH",
    body: JSON.stringify({
      minor_threshold: payload.minorThreshold,
      moderate_threshold: payload.moderateThreshold,
      severe_threshold: payload.severeThreshold,
      email_digest_time: payload.emailDigestTime,
      sms_for_severe_enabled: payload.smsForSevereEnabled,
      data_retention_days: payload.dataRetentionDays,
    }),
  });
  return mapSettings(data);
}

// --- routing (real routes, real hazard scoring) ---

function mapHazards(h: any): HazardBreakdown {
  return { minor: h.minor, moderate: h.moderate, severe: h.severe, total: h.total, score: h.score };
}

function mapRouteOption(r: any): RouteOption {
  return {
    label: r.label,
    geometry: r.geometry,
    distanceKm: r.distance_km,
    durationMin: r.duration_min,
    hazards: mapHazards(r.hazards),
    estimated: r.estimated,
    steps: (r.steps ?? []).map((s: any) => ({
      instruction: s.instruction,
      distanceM: s.distance_m,
      lat: s.lat,
      lon: s.lon,
    })),
  };
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return [];
  const data = await request<any[]>(`/routing/search?q=${encodeURIComponent(query)}`, {
    auth: false,
  });
  return data.map((p) => ({ label: p.label, latitude: p.latitude, longitude: p.longitude }));
}

export async function getRouteOptions(input: {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
}): Promise<RouteOption[]> {
  const data = await request<any[]>("/routing/routes", {
    method: "POST",
    body: JSON.stringify({
      from_lat: input.fromLat,
      from_lon: input.fromLon,
      to_lat: input.toLat,
      to_lon: input.toLon,
    }),
    auth: false,
  });
  return data.map(mapRouteOption);
}

// --- business fleet ---

function mapVehicle(v: any): Vehicle {
  return { id: v.id, name: v.name, plateNumber: v.plate_number ?? undefined };
}

function mapCorridor(c: any): Corridor {
  return {
    id: c.id,
    name: c.name,
    startLat: c.start_lat,
    startLon: c.start_lon,
    endLat: c.end_lat,
    endLon: c.end_lon,
  };
}

export async function getVehicles(): Promise<Vehicle[]> {
  const data = await request<any[]>("/business/vehicles");
  return data.map(mapVehicle);
}

export async function createVehicle(input: { name: string; plateNumber?: string }): Promise<Vehicle> {
  const data = await request<any>("/business/vehicles", {
    method: "POST",
    body: JSON.stringify({ name: input.name, plate_number: input.plateNumber }),
  });
  return mapVehicle(data);
}

export async function deleteVehicle(id: number): Promise<void> {
  await request<void>(`/business/vehicles/${id}`, { method: "DELETE" });
}

export async function getCorridors(): Promise<Corridor[]> {
  const data = await request<any[]>("/business/corridors");
  return data.map(mapCorridor);
}

export async function createCorridor(input: {
  name: string;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}): Promise<Corridor> {
  const data = await request<any>("/business/corridors", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      start_lat: input.startLat,
      start_lon: input.startLon,
      end_lat: input.endLat,
      end_lon: input.endLon,
    }),
  });
  return mapCorridor(data);
}

export async function deleteCorridor(id: number): Promise<void> {
  await request<void>(`/business/corridors/${id}`, { method: "DELETE" });
}

export async function getCorridorRisk(id: number): Promise<CorridorRisk> {
  const data = await request<any>(`/business/corridors/${id}/risk`);
  return {
    corridorId: data.corridor_id,
    name: data.name,
    distanceKm: data.distance_km,
    durationMin: data.duration_min,
    hazards: mapHazards(data.hazards),
    estimated: data.estimated,
  };
}

export async function getBusinessSummary(): Promise<BusinessSummary> {
  const data = await request<any>("/business/summary");
  return {
    vehicleCount: data.vehicle_count,
    corridorCount: data.corridor_count,
    severeHazardsNetworkWide: data.severe_hazards_network_wide,
    repairsThisWeekNetworkWide: data.repairs_this_week_network_wide,
  };
}

export { ApiError };
