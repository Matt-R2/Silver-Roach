"use client";

export type ProfileTab = "general" | "profile" | "alerts";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "profile", label: "Profile" },
  { key: "alerts", label: "Price Alerts" },
];

export function ProfileTabs({ active, onChange }: { active: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line overflow-hidden">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm transition ${
            active === tab.key ? "bg-ink text-bg font-semibold" : "text-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
