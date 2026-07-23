export const inputClass =
  "w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-sm text-ink focus:border-up focus:outline-none";
export const labelClass = "block text-[11px] uppercase tracking-wider text-muted";

export function Section({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const borderClass = tone === "danger" ? "border-down/40" : "border-line";
  const titleClass = tone === "danger" ? "text-down" : "text-dim";

  return (
    <section className={`rounded-2xl border ${borderClass} bg-panel p-6 space-y-4`}>
      <h2 className={`font-display text-sm uppercase tracking-[0.12em] ${titleClass}`}>{title}</h2>
      {children}
    </section>
  );
}
