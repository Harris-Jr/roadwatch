import type {
  AppSettings,
  AppUser,
  DashboardSummary,
  Plan,
  Pothole,
  ProcessingJob,
  RoadCategory,
  RoadSegment,
  Severity,
  Status,
  Source,
  UserRole,
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
  photo: File;
  latitude: number;
  longitude: number;
  severity?: Severity;
  note?: string;
}): Promise<Pothole> {
  const form = new FormData();
  form.set("photo", input.photo);
  form.set("latitude", String(input.latitude));
  form.set("longitude", String(input.longitude));
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

export { ApiError };
