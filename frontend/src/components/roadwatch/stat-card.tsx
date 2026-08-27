import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "accent" | "danger" | "success";
  icon?: ReactNode;
}) {
  const tones = {
    default: "bg-card text-ink",
    primary: "bg-peach text-ink",
    accent: "bg-teal/25 text-ink",
    danger: "bg-coral/40 text-ink",
    success: "bg-primary text-primary-foreground",
  };
  return (
    <div
      className={cn(
        "rounded-3xl p-5 shadow-[0_1px_2px_rgba(22,34,30,0.04),0_12px_30px_-20px_rgba(22,34,30,0.2)]",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold tracking-tight">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs opacity-70">{hint}</div>}
    </div>
  );
}
