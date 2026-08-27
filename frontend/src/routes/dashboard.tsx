import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Car, LayoutDashboard, LogOut, Menu, Route as RouteIcon, ShieldCheck, Truck, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const items = [
  { to: "/dashboard/driver", label: "Driver", icon: Car },
  { to: "/dashboard/business", label: "Business", icon: Truck },
] as const;

function DashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { user, ready, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (ready && (!user || user.role === "government")) {
      nav({ to: "/auth" });
    }
  }, [ready, user, nav]);

  if (!ready || !user || user.role === "government") {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }


  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-screen lg:translate-x-0 ${
          open ? "flex translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Link to="/" className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-base font-black">RoadWatch</div>
            <div className="text-xs opacity-70">My dashboard</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide opacity-60">
            Views
          </div>
          {items.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                }`}
                style={{ minHeight: 44 }}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          <div className="mt-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wide opacity-60">
            Quick
          </div>
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent"
            style={{ minHeight: 44 }}
          >
            <LayoutDashboard className="h-4 w-4" /> Public map
          </Link>
          <Link
            to="/navigate"
            className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent"
            style={{ minHeight: 44 }}
          >
            <RouteIcon className="h-4 w-4" /> Navigate
          </Link>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={() => {
              signOut();
              nav({ to: "/auth" });
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
          aria-label="Close"
          style={{ minHeight: 0 }}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-background/85 px-4 py-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="font-display text-lg font-extrabold text-ink">
              {pathname.includes("business") ? "Fleet dashboard" : "My RoadWatch"}
            </div>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-card hover:bg-muted"
            aria-label="Notifications"
            style={{ minHeight: 0 }}
          >
            <Bell className="h-4 w-4" />
          </button>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
