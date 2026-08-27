import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

const roleColor: Record<string, string> = {
  government: "bg-primary text-primary-foreground",
  business: "bg-accent text-accent-foreground",
  individual: "bg-slate-200 text-slate-800",
};

function AdminUsers() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: getUsers });

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {isLoading ? "Loading…" : `${users.length} registered users`}
      </div>
      <div className="overflow-x-auto rounded-lg border-2 border-border bg-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/70 text-xs font-bold uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Organization / Plan</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/40">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 font-bold text-primary">
                      {u.fullName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                    </div>
                    <div className="font-semibold">{u.fullName}</div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${roleColor[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {u.organization ?? (u.plan ? `${u.plan} plan` : "—")}
                </td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
