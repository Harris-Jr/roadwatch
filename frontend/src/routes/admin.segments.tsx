import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createRoadSegment, deleteRoadSegment, getRoadSegments } from "@/lib/api";
import type { RoadCategory } from "@/lib/types";

export const Route = createFileRoute("/admin/segments")({
  component: AdminSegments,
});

const CATEGORIES: RoadCategory[] = [
  "inter_territorial", "territorial", "district", "branch", "rural", "estate",
];

const catColor: Record<string, string> = {
  inter_territorial: "bg-primary/15 text-primary ring-primary/40",
  territorial: "bg-status-reported/15 text-blue-900 ring-status-reported/40",
  district: "bg-accent/15 text-orange-900 ring-accent/40",
  branch: "bg-slate-200 text-slate-800 ring-slate-300",
  rural: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  estate: "bg-purple-100 text-purple-900 ring-purple-300",
};

function AdminSegments() {
  const queryClient = useQueryClient();
  const { data: roads = [], isLoading } = useQuery({
    queryKey: ["road-segments"],
    queryFn: getRoadSegments,
  });
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<RoadCategory>("territorial");
  const [entity, setEntity] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createRoadSegment({ name, category, responsibleEntity: entity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["road-segments"] });
      setName("");
      setEntity("");
      setShowAdd(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRoadSegment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["road-segments"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{roads.length} road segments tracked</div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-bold text-primary-foreground"
        >
          {showAdd ? "Cancel" : "Add segment"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="grid gap-3 rounded-lg border-2 border-border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Road name"
            className="h-11 rounded-md border-2 border-border bg-background px-3 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RoadCategory)}
            className="h-11 rounded-md border-2 border-border bg-background px-2 text-sm capitalize"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace("_", " ")}</option>
            ))}
          </select>
          <input
            required
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="Responsible entity (e.g. RDA)"
            className="h-11 rounded-md border-2 border-border bg-background px-3 text-sm"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {createMutation.isPending ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border-2 border-border bg-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/70 text-xs font-bold uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Road name</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Responsible entity</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : roads.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No road segments yet.</td></tr>
            ) : (
              roads.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-3 font-semibold">{r.name}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 capitalize ${catColor[r.category]}`}>
                      {r.category.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-3">{r.responsibleEntity}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(r.id)}
                      disabled={deleteMutation.isPending}
                      className="h-9 rounded-md border-2 border-border bg-card px-3 text-xs font-bold hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      style={{ minHeight: 36 }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
