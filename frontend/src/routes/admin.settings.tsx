import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/lib/api";
import type { AppSettings } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: Partial<AppSettings>) => updateSettings(payload),
    onSuccess: (updated) => {
      setForm(updated);
      queryClient.setQueryData(["settings"], updated);
    },
  });

  if (isLoading || !form) {
    return <div className="text-sm text-muted-foreground">Loading settings…</div>;
  }

  const save = (patch: Partial<AppSettings>) => {
    const next = { ...form, ...patch };
    setForm(next);
    mutation.mutate(patch);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card title="Detection thresholds" desc="Minimum confidence required to auto-publish a detection to the public map.">
        <PercentRow label="Minor" value={form.minorThreshold} onChange={(v) => save({ minorThreshold: v })} />
        <PercentRow label="Moderate" value={form.moderateThreshold} onChange={(v) => save({ moderateThreshold: v })} />
        <PercentRow label="Severe" value={form.severeThreshold} onChange={(v) => save({ severeThreshold: v })} />
      </Card>
      <Card title="Notifications" desc="Where to route new-report alerts.">
        <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
          <div className="font-semibold">Email digest</div>
          <input
            type="time"
            value={form.emailDigestTime}
            onChange={(e) => save({ emailDigestTime: e.target.value })}
            className="h-9 rounded-md border-2 border-border bg-background px-2 text-sm"
          />
        </div>
        <div className="flex items-center justify-between py-2 text-sm">
          <div className="font-semibold">SMS for severe</div>
          <button
            onClick={() => save({ smsForSevereEnabled: !form.smsForSevereEnabled })}
            className={`h-8 w-14 rounded-full transition-colors ${form.smsForSevereEnabled ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`block h-6 w-6 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                form.smsForSevereEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>
      <Card title="Data retention" desc="How long raw dash-cam footage is kept after processing.">
        <div className="flex items-center justify-between py-2 text-sm">
          <div className="font-semibold">Retention (days)</div>
          <input
            type="number"
            min={1}
            value={form.dataRetentionDays}
            onChange={(e) => save({ dataRetentionDays: Number(e.target.value) })}
            className="h-9 w-24 rounded-md border-2 border-border bg-background px-2 text-right text-sm"
          />
        </div>
      </Card>
      {mutation.isSuccess && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> Saved
        </div>
      )}
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-border bg-card p-4">
      <div className="font-display text-lg font-black">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function PercentRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
      <div className="font-semibold">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-32"
        />
        <span className="w-10 text-right text-muted-foreground">{Math.round(value * 100)}%</span>
      </div>
    </div>
  );
}
