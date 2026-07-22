import Link from "next/link";
import { TrendingUp, PieChart, ShieldCheck, Scale, SlidersHorizontal, Gem, Flag } from "lucide-react";
import { METALS, ALL_SYMBOLS } from "@/lib/metals-meta";
import { usd, num } from "@/lib/units";

const AREA_LINE =
  "M0,140 C30,120 60,135 90,110 C120,85 150,100 180,70 C210,40 240,60 270,35 C300,10 330,25 360,5 L400,0";
const AREA_FILL = `${AREA_LINE} L400,160 L0,160 Z`;

const FEATURES: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string }[] = [
  {
    icon: Scale,
    title: "Real spot prices",
    body: "Prices are pulled from the market and refreshed automatically throughout the day, quoted per troy ounce.",
  },
  {
    icon: PieChart,
    title: "Breakdown your stack",
    body: "See your stack two ways — how much each metal is worth, and how much of it you actually hold by weight. Gold might lead one and not the other.",
  },
  {
    icon: SlidersHorizontal,
    title: "Track it your way",
    body: "Set the weight, unit, quantity, and purity for every holding; troy ounces or grams - karat or fineness.",
  },
  {
    icon: Gem,
    title: "Beyond the big four",
    body: "Gold, silver, platinum, and palladium get a live ticker — but rhodium, copper, nickel, aluminum, lead, and zinc are tracked too.",
  },
  {
    icon: ShieldCheck,
    title: "Your vault",
    body: "Every account is its own private stack. Sign in from anywhere — nobody else can see what you hold.",
  },
  {
    icon: TrendingUp,
    title: "Portfolio value over time",
    body: "See your whole stack priced against every day's market — with 7 day, 1 month, and 1 year views of what it's actually worth.",
  },
];

function Chip({ symbol }: { symbol: string }) {
  const m = METALS[symbol];
  return (
    <span
      className="grid place-items-center rounded-full font-mono font-bold text-[12px] flex-none"
      style={{
        width: 28,
        height: 28,
        color: m.color,
        background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${m.color} 40%, transparent)`,
      }}
    >
      {m.glyph}
    </span>
  );
}

function HeroMockup() {
  const composition = [
    { symbol: "AU", pct: 46 },
    { symbol: "AG", pct: 31 },
    { symbol: "PT", pct: 15 },
    { symbol: "PD", pct: 8 },
  ];
  let acc = 0;
  const gradientStops = composition
    .map((c) => {
      const from = acc;
      acc += c.pct;
      return `${METALS[c.symbol].color} ${from}% ${acc}%`;
    })
    .join(", ");

  const holdingsPreview = [
    { symbol: "AU", weight: 15, value: 40990.65 },
    { symbol: "AG", weight: 200, value: 6374.0 },
    { symbol: "PT", weight: 1, value: 960.45 },
    { symbol: "PD", weight: 1, value: 1042.18 },
  ];
  const portfolioValue = holdingsPreview.reduce((sum, h) => sum + h.value, 0);

  return (
    <div
      className="relative mx-auto w-full max-w-[460px] py-10"
      style={{ perspective: "1600px" }}
      aria-hidden="true"
    >
      {/* Soft glow behind the stack for depth */}
      <div
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(60% 55% at 55% 45%, rgba(79,178,134,0.16), transparent 70%)" }}
      />

      {/* Back card: composition, tucked behind and further into the distance */}
      <div
        className="absolute right-[-4%] bottom-[-38px] w-[58%] rounded-2xl border border-hair bg-panel p-4 opacity-90"
        style={{
          transform: "translateZ(-60px) rotateY(24deg) rotateX(10deg) rotate(4deg) scale(0.92)",
          transformStyle: "preserve-3d",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.55)",
        }}
      >
        <div className="text-[9px] uppercase tracking-[0.12em] text-dim mb-3">Composition by worth</div>
        <div className="flex items-center gap-3">
          <div
            className="rounded-full flex-none"
            style={{
              width: 72,
              height: 72,
              background: `conic-gradient(${gradientStops})`,
              mask: "radial-gradient(circle, transparent 42%, black 43%)",
              WebkitMask: "radial-gradient(circle, transparent 42%, black 43%)",
            }}
          />
          <div className="flex flex-col gap-1.5 min-w-0">
            {composition.map((c) => (
              <div key={c.symbol} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: METALS[c.symbol].color }} />
                <span className="text-muted">{METALS[c.symbol].name}</span>
                <span className="font-mono text-dim ml-auto">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Front card: value over time, angled toward the viewer */}
      <div
        className="relative left-[-4%] rounded-2xl border border-line bg-panel p-5"
        style={{
          transform: "translateZ(40px) rotateY(-24deg) rotateX(11deg) rotate(-3deg)",
          transformStyle: "preserve-3d",
          boxShadow: "0 40px 70px -15px rgba(0,0,0,0.65)",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          {["AU", "AG", "PT", "PD"].map((s) => (
            <Chip key={s} symbol={s} />
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-dim mb-1">Portfolio value</div>
        <div className="font-mono font-bold text-3xl tracking-tight mb-4">{usd(portfolioValue)}</div>
        <svg viewBox="0 0 400 160" className="w-full h-28" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4FB286" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#4FB286" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={AREA_FILL} fill="url(#hero-fill)" />
          <path d={AREA_LINE} fill="none" stroke="#4FB286" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="flex justify-between text-[9px] font-mono text-dim mt-1">
          <span>Jun</span>
          <span>Jul</span>
          <span>Aug</span>
        </div>

        <div className="mt-4 pt-3.5 border-t border-hair flex flex-col gap-2.5">
          {holdingsPreview.map((h) => (
            <div key={h.symbol} className="flex items-center gap-2.5 text-[11px]">
              <Chip symbol={h.symbol} />
              <span className="text-ink">{METALS[h.symbol].name}</span>
              <span className="font-mono text-dim">{num(h.weight, 0)} oz</span>
              <span className="font-mono ml-auto">{usd(h.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <header className="mx-auto max-w-6xl px-5 sm:px-8 py-5 sm:py-6 flex items-center justify-between gap-3">
        <div className="font-display text-base sm:text-xl font-bold tracking-[0.08em] sm:tracking-[0.14em] whitespace-nowrap shrink-0">
          SILVER ROACH<span className="text-up">.</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link href="/login" className="text-xs sm:text-sm text-muted hover:text-ink whitespace-nowrap">
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="whitespace-nowrap rounded-lg bg-ink px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-[13px] font-semibold text-bg hover:opacity-90"
          >
            Create account
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-6 pb-20 grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-5">
            Know what your metals are worth. Every day.
          </h1>
          <p className="text-muted text-base sm:text-lg leading-relaxed mb-8 max-w-md">
            Track gold, silver, platinum, palladium and more in one place — live spot prices, portfolio value over
            time, and a breakdown of exactly what your stack is made of.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/login?mode=signup"
              className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-bg hover:opacity-90"
            >
              Create free account
            </Link>
            <Link
              href="/demo"
              className="rounded-lg border border-line px-5 py-3 text-sm font-semibold text-ink hover:bg-raised"
            >
              Not convinced? Try it here
            </Link>
          </div>
          <Link href="/login" className="mt-4 inline-block text-sm text-muted hover:text-ink">
            Already have an account? Sign in →
          </Link>
        </div>
        <HeroMockup />
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 sm:px-8 py-16 border-t border-hair">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Everything your spreadsheet couldn&apos;t do
          </h2>
          <p className="text-muted max-w-lg mx-auto">
            Built for people who actually hold metal — not just watch a ticker.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-hair bg-panel p-6">
              <div className="grid place-items-center w-9 h-9 rounded-lg bg-raised border border-hair mb-4 text-up">
                <Icon size={18} />
              </div>
              <h3 className="font-semibold text-[15px] mb-2">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-hair bg-panel px-6 py-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm font-semibold mb-1.5">
            <Flag size={16} className="text-up" />
            <span>Developed in the US</span>
          </div>
          <p className="text-sm text-muted max-w-md mx-auto">
            Support a small, independently run project — your feedback shapes what we build next. We serve you.
          </p>
        </div>
      </section>

      {/* Metals */}
      <section id="metals" className="mx-auto max-w-6xl px-5 sm:px-8 py-16 border-t border-hair">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3">Every metal, one dashboard</h2>
          <p className="text-muted max-w-lg mx-auto">
            From bullion to base metals — add whatever you actually hold.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {ALL_SYMBOLS.map((s) => {
            const m = METALS[s];
            return (
              <div
                key={s}
                className="flex items-center gap-2.5 rounded-full border border-hair bg-panel pl-2.5 pr-4 py-2"
              >
                <Chip symbol={s} />
                <span className="text-sm">{m.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-16 border-t border-hair text-center">
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-4">Start tracking your stack</h2>
        <p className="text-muted max-w-md mx-auto mb-7">
          Free to use. Takes less than a minute to add your first holding.
        </p>
        <Link
          href="/login?mode=signup"
          className="inline-block rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-bg hover:opacity-90"
        >
          Create free account
        </Link>
      </section>

      <footer className="mx-auto max-w-6xl px-5 sm:px-8 py-8 border-t border-hair text-xs text-dim leading-relaxed">
        Spot prices via Metal Sentinel (Kitco), quoted per troy ounce. Not investment advice.
      </footer>
    </main>
  );
}
