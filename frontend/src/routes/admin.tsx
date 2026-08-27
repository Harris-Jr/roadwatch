import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  LogOut,
  Map,
  Menu,
  Settings,
  Upload,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { useEffect, useState } from "react";
import logoAsset from "@/assets/logo-pothole.png.asset.json";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/reports", label: "Road Reports", icon: ClipboardList },
  { to: "/admin/map", label: "Map View", icon: Map },
  { to: "/admin/video", label: "Video Upload & Processing", icon: Upload },
  { to: "/admin/segments", label: "Road Segments", icon: Waypoints },
  { to: "/admin/users", label: "Users & Roles", icon: UsersRound },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { user, ready, signOut } = useAuth();
  const nav_ = useNavigate();

  useEffect(() => {
    if (ready && (!user || user.role !== "government")) {
      nav_({ to: "/auth" });
    }
  }, [ready, user, nav_]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  if (!ready || !user || user.role !== "government") {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-screen lg:translate-x-0 ${
          open ? "flex translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <img src={logoAsset.url} alt="" className="h-9 w-9 shrink-0 object-contain" />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-black">
              RoadWatch <span className="opacity-70">Zambia</span>
            </div>
            <div className="text-xs opacity-70">Admin portal</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {nav.map((n) => {
            const active = isActive(n.to, "exact" in n && n.exact);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-inner"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                style={{ minHeight: 44 }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-md bg-sidebar-accent/50 p-2 text-xs">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary font-bold text-sidebar-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold">{user.fullName}</div>
              <div className="truncate opacity-70">{user.organization ?? "Government"}</div>
            </div>
          </div>
          <button
            onClick={() => {
              signOut();
              nav_({ to: "/auth" });
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <button
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Close sidebar"
          style={{ minHeight: 0 }}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b-2 border-border bg-card px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-11 w-11 place-items-center rounded-md hover:bg-muted lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm font-semibold text-muted-foreground">Admin</div>
            <span className="text-muted-foreground">/</span>
            <div className="font-display text-lg font-black">{crumb(pathname)}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Republic of Zambia · {user.organization ?? "Government"}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function crumb(path: string) {
  if (path === "/admin") return "Dashboard";
  const key = path.replace(/^\/admin\/?/, "").split("/")[0];
  return (
    {
      reports: "Road Reports",
      map: "Map View",
      video: "Video Upload & Processing",
      segments: "Road Segments",
      users: "Users & Roles",
      settings: "Settings",
    }[key] ?? "Dashboard"
  );
}
