import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { BrandLockup } from "@/components/site/brand-lockup";
import { Building2, Car, Check, Eye, EyeOff, Landmark, Lock, Mail, User } from "lucide-react";
import { login, signup, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { UserRole, Plan } from "@/lib/types";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login or sign up — RoadWatch Zambia" },
      { name: "description", content: "Log in or create a RoadWatch Zambia account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Tab = "login" | "signup";

function AuthPage() {
  const [tab, setTab] = useState<Tab>("login");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<UserRole>("individual");
  const [plan, setPlan] = useState<Plan>("free");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const { signIn } = useAuth();

  const routeForRole = (r: UserRole) => {
    if (r === "government") nav({ to: "/admin" });
    else if (r === "business") nav({ to: "/dashboard/business" });
    else nav({ to: "/dashboard/driver" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "signup" && role === "government") return;
    setSubmitting(true);
    setError(null);
    try {
      const auth =
        tab === "login"
          ? await login(email, password)
          : await signup({ email, password, fullName, role, plan });
      signIn(auth);
      // Route by the role the backend actually returned, not a guess —
      // this is the real fix for login not knowing which dashboard to open.
      routeForRole(auth.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
        <div className="hidden lg:block">
          <div className="rounded-[2.5rem] bg-peach p-10">
            <BrandLockup size="lg" caption="Road intelligence" />
            <div className="mt-8 text-[11px] font-bold uppercase tracking-wider text-ink/70">Account</div>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">
              One login.<br />Three ways in.
            </h1>
            <p className="mt-4 max-w-md text-ink/70">
              Individual drivers, fleet operators and government staff all use the same
              RoadWatch account. Your role decides which dashboard opens next.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-ink/80">
              {[
                "Free access for individual drivers, always.",
                "Premium and Business tiers for advanced routing and fleet tools.",
                "RDA and city / municipal council portals with repair workflows.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="soft-card overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-2">
            {(["login", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-11 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-transparent text-ink/60 hover:bg-muted"
                }`}
                style={{ minHeight: 0 }}
              >
                {t === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4 p-6">
            {tab === "signup" && (
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  What best describes you?
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <RolePick
                    active={role === "individual"}
                    onClick={() => {
                      setRole("individual");
                      setPlan("free");
                    }}
                    icon={<Car className="h-4 w-4" />}
                    title="Individual"
                    body="Personal driver"
                  />
                  <RolePick
                    active={role === "business"}
                    onClick={() => {
                      setRole("business");
                      setPlan("business");
                    }}
                    icon={<Building2 className="h-4 w-4" />}
                    title="Business"
                    body="Fleet operator"
                  />
                  <RolePick
                    active={role === "government"}
                    onClick={() => setRole("government")}
                    icon={<Landmark className="h-4 w-4" />}
                    title="Government"
                    body="RDA / council"
                  />
                </div>
              </div>
            )}

            {tab === "signup" && (
              <Field label="Full name">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rw-input pl-9"
                    placeholder="Chanda Mwansa"
                  />
                </div>
              </Field>
            )}

            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rw-input pl-9"
                  placeholder="you@example.com"
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rw-input pl-9 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded hover:bg-muted"
                  style={{ minHeight: 0 }}
                  aria-label="Toggle password"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {tab === "login" && (
              <div className="-mt-2 text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {tab === "signup" && role === "individual" && (
              <PlanPicker
                value={plan}
                onChange={setPlan}
                options={[
                  {
                    id: "free",
                    name: "Free",
                    price: "K 0",
                    bullets: ["Live public map", "Drive-mode capture", "Quick photo report"],
                  },
                  {
                    id: "premium",
                    name: "Premium",
                    price: "K 79/mo",
                    bullets: [
                      "Alerts on saved routes",
                      "Alt-route planner",
                      "Export ride history",
                    ],
                  },
                ]}
              />
            )}

            {tab === "signup" && role === "business" && (
              <PlanPicker
                value={plan}
                onChange={setPlan}
                options={[
                  {
                    id: "free",
                    name: "Starter",
                    price: "K 0",
                    bullets: ["1 saved route", "Basic hazard map", "No exports"],
                  },
                  {
                    id: "business",
                    name: "Business",
                    price: "K 449/mo",
                    bullets: ["Fleet corridor risk", "CSV & PDF export", "Team seats"],
                  },
                ]}
              />
            )}

            {tab === "signup" && role === "government" && (
              <div className="rounded-2xl bg-peach px-4 py-3 text-xs text-ink/80">
                Government portals are provisioned by the RoadWatch team. Reach out
                via <Link to="/contact" className="font-bold text-primary underline">Contact</Link> for
                institutional access.
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive">
                {error}
              </div>
            )}

            {tab === "signup" && role === "government" ? (
              <Link
                to="/contact"
                className="btn-pill btn-pill-primary w-full text-base"
              >
                Go to Contact
              </Link>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="btn-pill btn-pill-primary w-full text-base disabled:opacity-50"
              >
                {submitting ? "Please wait…" : tab === "login" ? "Log in" : "Create account"}
              </button>
            )}

            <div className="text-center text-xs text-muted-foreground">
              {tab === "login" ? (
                <>
                  New to RoadWatch?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    className="font-bold text-primary hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("login")}
                    className="font-bold text-primary hover:underline"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink/60">
        {label}
      </span>
      {children}
    </label>
  );
}

function RolePick({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl p-3 text-left transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-ink hover:bg-peach"
      }`}
      style={{ minHeight: 0 }}
    >
      <div className={`flex items-center gap-1.5 ${active ? "text-primary-foreground" : "text-primary"}`}>
        {icon}
      </div>
      <div className="mt-1 font-display text-sm font-extrabold">{title}</div>
      <div className={`text-[11px] ${active ? "text-primary-foreground/75" : "text-ink/60"}`}>
        {body}
      </div>
    </button>
  );
}

function PlanPicker({
  value,
  onChange,
  options,
}: {
  value: Plan;
  onChange: (p: Plan) => void;
  options: { id: Plan; name: string; price: string; bullets: string[] }[];
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink/60">
        Choose a plan
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              type="button"
              key={o.id}
              onClick={() => onChange(o.id)}
              className={`rounded-2xl p-4 text-left transition-colors ${
                active
                  ? "bg-teal/35 ring-2 ring-primary"
                  : "bg-muted hover:bg-peach"
              }`}
              style={{ minHeight: 0 }}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-base font-extrabold text-ink">{o.name}</div>
                <div className="text-xs font-bold text-ink/70">{o.price}</div>
              </div>
              <ul className="mt-2 space-y-1 text-[11px] text-ink/70">
                {o.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
