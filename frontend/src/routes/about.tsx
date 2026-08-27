import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { Camera, MapPinned, Wrench, ArrowRight, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — RoadWatch Zambia" },
      {
        name: "description",
        content:
          "How RoadWatch Zambia uses AI to detect potholes, map them in real time, and route repairs to the RDA and city councils.",
      },
      { property: "og:title", content: "About RoadWatch Zambia" },
      {
        property: "og:description",
        content: "AI-assisted road monitoring for Zambian roads.",
      },
    ],
  }),
  component: About,
});

/* ---------- decorative blob illustrations ---------- */

function CarBlob({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden>
      <ellipse cx="160" cy="200" rx="130" ry="10" fill="#16221E" opacity="0.12" />
      <path
        d="M50 150 Q50 90 130 90 L200 90 Q260 90 268 130 L282 148 Q295 150 293 168 L293 180 Q293 190 283 190 L245 190 Q240 205 225 205 Q210 205 205 190 L120 190 Q115 205 100 205 Q85 205 80 190 L60 190 Q50 190 50 180 Z"
        fill="#4FB8AC"
      />
      <path d="M130 100 L195 100 Q240 100 250 130 L145 130 Z" fill="#F3DFC4" />
      <path d="M148 130 L245 130" stroke="#16221E" strokeWidth="2" opacity="0.15" />
      <circle cx="105" cy="188" r="18" fill="#16221E" />
      <circle cx="105" cy="188" r="7" fill="#FBF6EE" />
      <circle cx="230" cy="188" r="18" fill="#16221E" />
      <circle cx="230" cy="188" r="7" fill="#FBF6EE" />
      <circle cx="90" cy="150" r="4" fill="#16221E" />
      <circle cx="102" cy="150" r="4" fill="#16221E" />
      <path d="M90 162 Q98 168 106 162" stroke="#16221E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ConeBlob({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} aria-hidden>
      <ellipse cx="100" cy="200" rx="80" ry="8" fill="#16221E" opacity="0.15" />
      <path d="M60 195 L140 195 L128 145 L72 145 Z" fill="#F2A6A0" />
      <path d="M75 130 L125 130 L118 90 L82 90 Z" fill="#F2A6A0" />
      <path d="M85 75 L115 75 L110 45 L90 45 Z" fill="#F2A6A0" />
      <rect x="55" y="192" width="90" height="14" rx="4" fill="#16221E" />
      <rect x="75" y="128" width="50" height="8" fill="#FBF6EE" />
      <rect x="72" y="160" width="56" height="8" fill="#FBF6EE" />
      <circle cx="95" cy="65" r="2.5" fill="#16221E" />
      <circle cx="105" cy="65" r="2.5" fill="#16221E" />
      <path d="M95 72 Q100 76 105 72" stroke="#16221E" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function FixedBlob({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden>
      <path
        d="M120 20 Q180 20 200 70 Q220 130 170 165 Q120 195 70 165 Q20 130 40 70 Q60 20 120 20 Z"
        fill="#E8B84B"
      />
      <path
        d="M85 100 L110 125 L160 75"
        stroke="#16221E"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="45" cy="45" r="6" fill="#F3DFC4" />
      <circle cx="200" cy="55" r="4" fill="#F3DFC4" />
      <circle cx="195" cy="150" r="5" fill="#F3DFC4" />
      <circle cx="50" cy="160" r="4" fill="#F3DFC4" />
    </svg>
  );
}

/* ---------- page ---------- */

function About() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO — peach panel */}
      <section className="mx-auto max-w-7xl px-4 pt-6 lg:pt-10">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-peach px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <span className="inline-flex items-center rounded-full bg-ink/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
                About RoadWatch Zambia
              </span>
              <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Safer roads,<br />mapped in real time.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/70 sm:text-lg">
                We combine dashcam AI, citizen reporting and council workflows to make
                Zambia's road network measurable — and fixable.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth" className="btn-pill btn-pill-primary">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/contact" className="btn-pill btn-pill-secondary">
                  Talk to us
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-teal/40" aria-hidden />
              <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-coral/70" aria-hidden />
              <CarBlob className="relative w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — alternating dark green + light */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">How it works</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Detect. Map. Route to repair.
          </h2>
        </div>

        <div className="mt-12 space-y-6">
          <StepRow
            n="01"
            title="AI detection"
            body="Dashcam footage and photo uploads are analysed for pothole size, depth and severity — automatically classified as minor, moderate or severe."
            icon={<Camera className="h-6 w-6" />}
            dark
            illustration={<ConeBlob className="w-56" />}
          />
          <StepRow
            n="02"
            title="Real-time mapping"
            body="Every confirmed pothole is geo-located and pinned to the public live map, so drivers and agencies see the same picture."
            icon={<MapPinned className="h-6 w-6" />}
            illustration={
              <div className="relative h-52 w-full max-w-sm rounded-3xl bg-peach p-6">
                <div className="absolute left-6 top-6 h-3 w-16 rounded-full bg-ink/20" />
                <div className="absolute left-6 top-12 h-3 w-24 rounded-full bg-ink/15" />
                <div className="absolute bottom-6 right-6 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <MapPinned className="h-7 w-7" />
                </div>
                <div className="absolute left-8 top-24 h-3 w-3 rounded-full bg-severity-severe" />
                <div className="absolute left-16 top-32 h-3 w-3 rounded-full bg-severity-moderate" />
                <div className="absolute left-24 top-20 h-3 w-3 rounded-full bg-severity-minor" />
              </div>
            }
          />
          <StepRow
            n="03"
            title="Routed to repair"
            body="Each hazard is auto-assigned to the responsible authority — the RDA for inter-territorial roads, city or municipal councils for the rest."
            icon={<Wrench className="h-6 w-6" />}
            dark
            illustration={<FixedBlob className="w-52" />}
          />
        </div>
      </section>

      {/* WHO IT'S FOR — three color-blocked cards */}
      <section className="mx-auto max-w-7xl px-4 py-8 lg:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Who it's for</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Built for three audiences.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <AudienceCard
            tone="peach"
            eyebrow="Motorists · Free"
            title="Everyday drivers"
            body="Drive-mode dashcam capture, a live pothole map and quick photo reporting — free forever."
            ctaTo="/auth"
            ctaLabel="Sign up free"
          />
          <AudienceCard
            tone="teal"
            eyebrow="Businesses · Premium"
            title="Fleets & logistics"
            body="Corridor-level risk, alerts on saved routes and exportable history for logistics teams."
            ctaTo="/auth"
            ctaLabel="Start a trial"
          />
          <AudienceCard
            tone="mustard"
            eyebrow="Government · Institutional"
            title="RDA & councils"
            body="Video AI processing, repair workflows and council-level dashboards, provisioned by our team."
            ctaTo="/contact"
            ctaLabel="Talk to us"
          />
        </div>
      </section>

      {/* IMPACT — dark green band */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="rounded-[2.5rem] bg-primary px-6 py-14 text-primary-foreground sm:px-12 lg:px-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-primary-foreground/70">
              Impact so far
            </div>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl">
              Real numbers from real roads.
            </h2>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <BigStat value="12,480" label="Potholes tracked" />
            <BigStat value="4,912" label="Repairs completed" />
            <BigStat value="18 days" label="Avg. time to fix" />
            <BigStat value="34" label="Active council teams" />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Working with
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
          {[
            "Road Development Agency",
            "Lusaka City Council",
            "Kitwe City Council",
            "Ndola City Council",
            "Livingstone Council",
            "Kabwe Council",
          ].map((n) => (
            <span
              key={n}
              className="font-display text-sm font-extrabold uppercase tracking-wider text-ink/60"
            >
              {n}
            </span>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-24">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Questions</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Frequently asked.
          </h2>
        </div>
        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <FaqItem key={i} {...f} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------- pieces ---------- */

function StepRow({
  n,
  title,
  body,
  icon,
  dark,
  illustration,
}: {
  n: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  dark?: boolean;
  illustration: React.ReactNode;
}) {
  return (
    <div
      className={`grid items-center gap-8 rounded-[2rem] p-8 lg:grid-cols-2 lg:p-12 ${
        dark ? "bg-primary text-primary-foreground" : "bg-card"
      }`}
    >
      <div className={dark ? "" : "order-2 lg:order-1"}>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            dark ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"
          }`}
        >
          <span>Step {n}</span>
        </div>
        <h3
          className={`mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${
            dark ? "text-primary-foreground" : "text-ink"
          }`}
        >
          {title}
        </h3>
        <p className={`mt-3 max-w-md text-base leading-relaxed ${dark ? "text-primary-foreground/80" : "text-ink/70"}`}>
          {body}
        </p>
        <div
          className={`mt-5 inline-grid h-11 w-11 place-items-center rounded-full ${
            dark ? "bg-teal text-ink" : "bg-primary text-primary-foreground"
          }`}
        >
          {icon}
        </div>
      </div>
      <div className={`grid place-items-center ${dark ? "" : "order-1 lg:order-2"}`}>{illustration}</div>
    </div>
  );
}

function AudienceCard({
  tone,
  eyebrow,
  title,
  body,
  ctaTo,
  ctaLabel,
}: {
  tone: "peach" | "teal" | "mustard";
  eyebrow: string;
  title: string;
  body: string;
  ctaTo: "/auth" | "/contact";
  ctaLabel: string;
}) {
  const bg = { peach: "bg-peach", teal: "bg-teal/40", mustard: "bg-mustard/60" }[tone];
  return (
    <div className={`flex flex-col rounded-[2rem] p-8 ${bg}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink/70">{eyebrow}</div>
      <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/75">{body}</p>
      <Link
        to={ctaTo}
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-ink px-5 text-xs font-bold uppercase tracking-wide text-background hover:bg-ink/90"
        style={{ minHeight: 0 }}
      >
        {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl">
        {value}
      </div>
      <div className="mt-2 text-xs font-bold uppercase tracking-wider text-primary-foreground/70">
        {label}
      </div>
    </div>
  );
}

const faqs = [
  {
    q: "Is RoadWatch free to use?",
    a: "Yes — the public map, drive-mode capture and quick reporting are free forever for individual drivers. Premium tools are for fleets and institutional partners.",
  },
  {
    q: "Who receives the pothole reports?",
    a: "Each confirmed hazard is routed to the responsible authority automatically — the Road Development Agency for inter-territorial roads, city or municipal councils for the rest.",
  },
  {
    q: "How does the AI classify severity?",
    a: "Our vision model estimates pothole size and depth from dashcam frames, then classifies each hazard as minor, moderate or severe.",
  },
  {
    q: "Can my council or agency get access?",
    a: "Institutional portals are provisioned by our team. Reach out from the Contact page and we'll be in touch.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-card px-5 py-1 shadow-[0_1px_2px_rgba(22,34,30,0.04),0_10px_28px_-24px_rgba(22,34,30,0.2)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        style={{ minHeight: 0 }}
      >
        <span className="font-display text-base font-bold text-ink">{q}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
      </button>
      {open && <p className="pb-5 pr-10 text-sm leading-relaxed text-ink/70">{a}</p>}
    </div>
  );
}
