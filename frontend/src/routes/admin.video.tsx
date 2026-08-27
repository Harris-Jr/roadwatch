import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { UploadCloud, FileVideo, X } from "lucide-react";
import { SyncStatusIndicator } from "@/components/roadwatch/badges";
import { confirmReport, getJobDetections, getJobs, rejectReport, uploadVideo } from "@/lib/api";
import type { ProcessingJob } from "@/lib/types";

export const Route = createFileRoute("/admin/video")({
  component: AdminVideo,
});

function AdminVideo() {
  const queryClient = useQueryClient();
  const [drag, setDrag] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["uploads", "jobs"],
    queryFn: getJobs,
    // Video processing runs as a background task server-side — poll while
    // anything is still queued/processing so the progress bar keeps moving.
    refetchInterval: (query) => {
      const list = query.state.data as ProcessingJob[] | undefined;
      const active = list?.some((j) => j.status === "queued" || j.status === "processing");
      return active ? 2500 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadVideo(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["uploads", "jobs"] }),
  });

  const activeJob =
    jobs.find((j) => j.id === selectedJobId) ??
    jobs.find((j) => j.status === "completed" && j.detectionsFound > 0) ??
    null;

  const { data: detections = [] } = useQuery({
    queryKey: ["uploads", "jobs", activeJob?.id, "detections"],
    queryFn: () => getJobDetections(activeJob!.id),
    enabled: !!activeJob,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads", "jobs", activeJob?.id, "detections"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads", "jobs", activeJob?.id, "detections"] });
    },
  });

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-4 border-dashed p-10 text-center ${
          drag ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <UploadCloud className="mx-auto h-12 w-12 text-primary" />
        <div className="mt-3 font-display text-xl font-black">Drag and drop dash-cam or survey footage</div>
        <div className="mt-1 text-sm text-muted-foreground">
          MP4, MOV. Frames are sampled and run through the classifier after upload.
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {uploadMutation.isPending ? "Uploading…" : "Or select a file"}
        </button>
      </div>

      <div className="rounded-lg border-2 border-border bg-card">
        <div className="border-b border-border p-4 font-display text-lg font-black">Processing queue</div>
        <ul className="divide-y divide-border">
          {jobs.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">No footage uploaded yet.</li>
          )}
          {jobs.map((j) => (
            <li
              key={j.id}
              onClick={() => setSelectedJobId(j.id)}
              className={`cursor-pointer p-4 ${activeJob?.id === j.id ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileVideo className="h-6 w-6 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate font-bold">{j.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.framesProcessed} frames · {j.detectionsFound} detections
                    </div>
                  </div>
                </div>
                <SyncStatusIndicator
                  state={j.status === "completed" ? "uploaded" : j.status === "failed" ? "failed" : "syncing"}
                  label={
                    j.status === "completed"
                      ? "Processed"
                      : j.status === "failed"
                      ? "Failed"
                      : j.status === "queued"
                      ? "Queued"
                      : "Detecting potholes"
                  }
                />
              </div>
              {j.errorMessage && <div className="mt-2 text-xs text-destructive">{j.errorMessage}</div>}
            </li>
          ))}
        </ul>
      </div>

      {activeJob && (
        <div className="rounded-lg border-2 border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-black">Detections — {activeJob.filename}</div>
              <div className="text-xs text-muted-foreground">
                {detections.length} pending · confirm to add to public map
              </div>
            </div>
            {detections.length > 0 && (
              <button
                onClick={() => detections.forEach((d) => confirmMutation.mutate(d.id))}
                className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-bold text-primary-foreground"
              >
                Confirm all
              </button>
            )}
          </div>
          {detections.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nothing pending review for this file.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {detections.map((d) => (
                <div key={d.id} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                  <div className="relative aspect-video bg-gradient-to-br from-slate-400 to-slate-600">
                    <div className="absolute left-[25%] top-[35%] h-20 w-24 rounded border-2 border-accent">
                      <div className="absolute -top-5 left-0 rounded bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                        {d.severity.toUpperCase()} · {Math.round(d.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="text-sm font-semibold capitalize">{d.severity}</div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => confirmMutation.mutate(d.id)}
                        className="h-9 rounded-md bg-status-fixed/20 px-3 text-xs font-bold text-status-fixed"
                        style={{ minHeight: 36 }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(d.id)}
                        className="grid h-9 w-9 place-items-center rounded-md bg-destructive/10 text-destructive"
                        style={{ minHeight: 36 }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
