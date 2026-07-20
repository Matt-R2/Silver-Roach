// Pure data, safe to import in client components. No secrets, no fetch.

export type MetalSymbol = "AU" | "AG" | "PT" | "PD" | "RH" | "CU" | "NI" | "AL" | "PB" | "ZN";

// Colors are a fixed categorical identity palette, not decorative. Gold,
// silver, copper and rhodium keep their true metal tones; the rest were
// chosen so every pair clears a CVD-safety check (see the dataviz skill) —
// don't tweak one in isolation without re-running
// scripts/validate_palette.js against the others.
export const METALS: Record<string, { name: string; glyph: string; color: string }> = {
  AU: { name: "Gold", glyph: "Au", color: "#CBA135" },
  AG: { name: "Silver", glyph: "Ag", color: "#AEB7C2" },
  PT: { name: "Platinum", glyph: "Pt", color: "#56B4E9" },
  PD: { name: "Palladium", glyph: "Pd", color: "#CC79A7" },
  RH: { name: "Rhodium", glyph: "Rh", color: "#C9C2D6" },
  CU: { name: "Copper", glyph: "Cu", color: "#B5713A" },
  NI: { name: "Nickel", glyph: "Ni", color: "#009E73" },
  AL: { name: "Aluminum", glyph: "Al", color: "#0072B2" },
  PB: { name: "Lead", glyph: "Pb", color: "#A0526B" },
  ZN: { name: "Zinc", glyph: "Zn", color: "#1878A0" },
};

// The four precious metals shown in the spot ticker by default.
export const TICKER_SYMBOLS: MetalSymbol[] = ["AU", "AG", "PT", "PD"];

export const ALL_SYMBOLS = Object.keys(METALS) as MetalSymbol[];
