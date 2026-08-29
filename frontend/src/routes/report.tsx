import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  MapPin,
  ShieldAlert,
  Upload,
  Video,
} from "lucide-react";
import { LeafletMap } from "@/components/roadwatch/leaflet-map";
import { getReports, submitQuickReport } from "@/lib/api";
import type { Severity } from "@/lib/types";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a pothole — RoadWatch Zambia" },
      { name: "description", content: "Report a pothole in three quick steps: capture, confirm location, and submit." },
    ],
  }),
  component: ReportFlow,
});

type Step = 1 | 2 | 3;
type Mode = "photo" | "video";

function ReportFlow() {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>("photo");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [note, setNote] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("This browser doesn't support location — we'll try to read GPS coordinates from your photo/video instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(null);
      },
      () => setGeoError("Couldn't get your location — if your photo/video has GPS coordinates visible in it, we'll try reading those instead."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleMediaSelected = (file: File) => {
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!mediaFile) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // No fallback coordinates are sent if geolocation failed — the
      // backend will try reading GPS text burned into the photo/video via
      // OCR instead, and only reject if neither source has a location.
      await submitQuickReport({
        photo: mode === "photo" ? mediaFile : undefined,
        video: mode === "video" ? mediaFile : undefined,
        latitude: coords?.lat,
        longitude: coords?.lng,
        severity,
        note: note || undefined,
      });
      setStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong submitting your report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link to="/" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="font-display text-base font-black">Report a pothole</div>
        <div className="ml-auto text-xs font-semibold text-muted-foreground">Step {step} of 3</div>
      </header>

      <Stepper step={step} />

      <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
        {step === 1 && (
          <StepCapture
            mode={mode}
            setMode={setMode}
            mediaFile={mediaFile}
            mediaPreviewUrl={mediaPreviewUrl}
            onMediaSelected={handleMediaSelected}
            severity={severity}
            setSeverity={setSeverity}
            onNext={() => {
              setStep(2);
              requestLocation();
            }}
          />
        )}
        {step === 2 && (
          <StepLocation
            note={note}
            setNote={setNote}
            coords={coords}
            geoError={geoError}
            onRetryLocation={requestLocation}
            submitting={submitting}
            submitError={submitError}
            onBack={() => setStep(1)}
            onSubmit={handleSubmit}
          />
        )}
        {step === 3 && <StepSuccess />}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = ["Capture", "Location", "Submitted"];
  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        {items.map((label, i) => {
          const n = (i + 1) as Step;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "bg-peach text-ink ring-2 ring-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  active ? "text-ink" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {i < items.length - 1 && <div className="h-0.5 flex-1 rounded bg-muted" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepCapture({
  mode,
  setMode,
  mediaFile,
  mediaPreviewUrl,
  onMediaSelected,
  severity,
  setSeverity,
  onNext,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  mediaFile: File | null;
  mediaPreviewUrl: string | null;
  onMediaSelected: (file: File) => void;
  severity: Severity;
  setSeverity: (s: Severity) => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl bg-peach p-3 text-sm text-ink">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <div>
          <strong>Only report when safely stopped.</strong> Never file a report while driving.
        </div>
      </div>

      <div className="flex gap-2">
        {(["photo", "video"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              if (m !== mode) {
                setMode(m);
              }
            }}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors ${
              mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-ink hover:bg-peach"
            }`}
            style={{ minHeight: 0 }}
          >
            {m === "photo" ? <Camera className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
            {m === "photo" ? "Photo" : "Short video"}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink/60">
          {mode === "photo" ? "Photo" : "Video (first 8 seconds are scanned)"}
        </label>
        <input
          key={mode}
          ref={inputRef}
          type="file"
          accept={mode === "photo" ? "image/*" : "video/*"}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onMediaSelected(file);
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className={`flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed p-6 text-sm font-semibold transition-colors ${
            mediaPreviewUrl
              ? "border-primary bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
          style={{ minHeight: 0 }}
        >
          {mediaPreviewUrl ? (
            mode === "photo" ? (
              <img src={mediaPreviewUrl} alt="Selected pothole photo" className="h-full w-full object-cover" />
            ) : (
              <video src={mediaPreviewUrl} className="h-full w-full object-cover" muted playsInline autoPlay loop />
            )
          ) : mode === "photo" ? (
            <>
              <Camera className="h-8 w-8" />
              Tap to take a photo or pick from gallery
            </>
          ) : (
            <>
              <Video className="h-8 w-8" />
              Tap to record or pick a short clip
            </>
          )}
        </button>
        {mediaFile && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{mediaFile.name}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink/60">
          Severity
        </label>
        <div className="flex gap-2">
          {(["minor", "moderate", "severe"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`h-12 flex-1 rounded-full text-sm font-bold capitalize transition-colors ${
                severity === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-ink hover:bg-peach"
              }`}
              style={{ minHeight: 0 }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={!mediaPreviewUrl}
        onClick={onNext}
        className="btn-pill btn-pill-primary mt-6 inline-flex w-full items-center justify-center gap-2 text-base disabled:opacity-50"
      >
        Continue <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepLocation({
  note,
  setNote,
  coords,
  geoError,
  onRetryLocation,
  submitting,
  submitError,
  onBack,
  onSubmit,
}: {
  note: string;
  setNote: (v: string) => void;
  coords: { lat: number; lng: number } | null;
  geoError: string | null;
  onRetryLocation: () => void;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { data: nearby = [] } = useQuery({
    queryKey: ["reports", "public", "nearby-preview"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink/60">
          Confirm location
        </label>
        <div className="relative h-64 overflow-hidden rounded-3xl">
          <LeafletMap potholes={nearby.slice(0, 4)} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="rounded-full bg-primary p-2.5 text-primary-foreground shadow-lg ring-4 ring-primary/30">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
        </div>
        {coords ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            GPS detected: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        ) : geoError ? (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-destructive">
            <span>{geoError}</span>
            <button onClick={onRetryLocation} className="font-bold underline">Retry</button>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Detecting your location…</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink/60">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Deep pothole near the roundabout, dangerous at night"
          className="w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {submitError && (
        <div className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{submitError}</div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="btn-pill inline-flex flex-1 items-center justify-center gap-2 bg-muted text-ink hover:bg-peach disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="btn-pill btn-pill-primary inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> {submitting ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </div>
  );
}

function StepSuccess() {
  const { data: recent = [] } = useQuery({
    queryKey: ["reports", "public", "post-submit"],
    queryFn: () => getReports({ confirmedOnly: true }),
  });

  return (
    <div className="space-y-4">
      <div className="mt-4 rounded-3xl bg-teal/25 p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-black text-ink">Report submitted</h1>
        <p className="mt-1 text-ink/70">
          Thank you — if our AI model was confident it's a pothole, your marker is already live on
          the map. Otherwise it's in the review queue for an admin to confirm.
        </p>
      </div>

      <div className="relative h-56 overflow-hidden rounded-3xl">
        <LeafletMap potholes={recent.slice(0, 6)} className="h-full w-full" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to="/"
          className="btn-pill inline-flex flex-1 items-center justify-center bg-muted text-ink hover:bg-peach"
        >
          Back to map
        </Link>
        <Link to="/report" className="btn-pill btn-pill-primary inline-flex flex-1 items-center justify-center">
          Report another
        </Link>
      </div>
    </div>
  );
}
