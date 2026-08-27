import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/site-header";
import { Mail } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — RoadWatch Zambia" },
      { name: "description", content: "Reset your RoadWatch Zambia password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="soft-card p-6">
          {!sent ? (
            <>
              <h1 className="font-display text-2xl font-extrabold text-ink">Reset your password</h1>
              <p className="mt-2 text-sm text-ink/70">
                Enter the email you used to sign up and we'll send a reset link.
              </p>
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink/60">
                    Email
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input type="email" required className="rw-input pl-9" placeholder="you@example.com" />
                  </div>
                </label>
                <button type="submit" className="btn-pill btn-pill-primary w-full text-base">
                  Send reset link
                </button>
                <div className="text-center text-xs text-muted-foreground">
                  <Link to="/auth" className="font-bold text-primary hover:underline">
                    Back to login
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-extrabold text-ink">Check your email</h1>
              <p className="mt-2 text-sm text-ink/70">
                If an account exists for that address, you'll receive a password reset link shortly.
              </p>
              <Link to="/auth" className="btn-pill btn-pill-primary mt-5 inline-flex w-full text-base">
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
