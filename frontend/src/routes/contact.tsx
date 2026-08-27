import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { Landmark, Mail, MessageSquare, Send, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — RoadWatch Zambia" },
      {
        name: "description",
        content:
          "Contact the RoadWatch Zambia team. Special inbox for RDA and city / municipal councils exploring institutional access.",
      },
      { property: "og:title", content: "Contact RoadWatch Zambia" },
      { property: "og:description", content: "Get in touch — general enquiries and institutional access." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            Contact
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-ink lg:text-5xl">
            Talk to the RoadWatch team.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink/70">
            Questions about the platform, partnerships, media enquiries — we'll come
            back within two working days.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Form */}
          <div className="soft-card p-6 lg:p-10">
            {sent ? (
              <div className="grid place-items-center gap-3 py-16 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="font-display text-2xl font-extrabold text-ink">Message sent</div>
                <p className="max-w-sm text-sm text-ink/70">
                  Thanks — someone from the RoadWatch team will get back to you
                  shortly.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="btn-pill btn-pill-secondary mt-2"
                  style={{ minHeight: 0 }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" required>
                    <input required className="rw-input" placeholder="Chanda Mwansa" />
                  </Field>
                  <Field label="Email" required>
                    <input type="email" required className="rw-input" placeholder="you@example.com" />
                  </Field>
                </div>
                <Field label="Organisation">
                  <input className="rw-input" placeholder="Optional" />
                </Field>
                <Field label="Message" required>
                  <textarea
                    required
                    rows={5}
                    className="rw-input resize-y py-3"
                    style={{ borderRadius: "1.25rem", height: "auto" }}
                    placeholder="How can we help?"
                  />
                </Field>
                <button
                  type="submit"
                  className="btn-pill btn-pill-primary w-full"
                >
                  <Send className="h-4 w-4" />
                  Send message
                </button>
              </form>
            )}
          </div>

          {/* Side — cream / peach panels */}
          <div className="space-y-6">
            <div className="rounded-[2rem] bg-peach p-8">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink/70">
                Institutional access
              </div>
              <h2 className="mt-1 font-display text-xl font-extrabold text-ink">
                Represent RDA or a council?
              </h2>
              <p className="mt-2 text-sm text-ink/75">
                We work directly with the Road Development Agency and city / municipal
                councils on portal access, integrations and repair workflows. This is
                a separate track from individual sign-up.
              </p>
              <a
                href="mailto:institutions@roadwatch.zm"
                className="btn-pill btn-pill-primary mt-5 w-full"
              >
                <Mail className="h-4 w-4" />
                institutions@roadwatch.zm
              </a>
            </div>

            <div className="rounded-[2rem] bg-card p-8 text-sm shadow-[0_1px_2px_rgba(22,34,30,0.04),0_12px_30px_-20px_rgba(22,34,30,0.15)]">
              <div className="flex items-center gap-2 font-display font-extrabold text-ink">
                <MessageSquare className="h-4 w-4 text-primary" />
                Other ways to reach us
              </div>
              <dl className="mt-3 space-y-3 text-ink/70">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink/60">General</dt>
                  <dd className="font-semibold text-ink">hello@roadwatch.zm</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink/60">Press</dt>
                  <dd className="font-semibold text-ink">press@roadwatch.zm</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink/60">Office</dt>
                  <dd className="font-semibold text-ink">Cairo Road, Lusaka, Zambia</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink/60">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
