import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { BrandLockup } from "./brand-lockup";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

function dashboardPathFor(role: string) {
  if (role === "government") return "/admin";
  if (role === "business") return "/dashboard/business";
  return "/dashboard/driver";
}

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, ready } = useAuth();
  const authTo = ready && user ? dashboardPathFor(user.role) : "/auth";
  const authLabel = ready && user ? user.fullName.split(" ")[0] : "Login";

  return (
    <header
      className={`z-40 w-full ${
        transparent
          ? "bg-background/85 backdrop-blur"
          : "bg-background"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
        <Link to="/" className="flex items-center">
          <BrandLockup size="sm" caption="Road intelligence" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-ink/70 hover:bg-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to={authTo}
            className="hidden h-10 items-center rounded-full bg-primary px-5 text-xs font-bold uppercase tracking-wide text-primary-foreground shadow-sm hover:bg-primary/90 md:inline-flex"
            style={{ minHeight: 0 }}
          >
            {authLabel}
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card md:hidden"
            aria-label="Menu"
            style={{ minHeight: 0 }}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-card p-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to={authTo}
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              {authLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
