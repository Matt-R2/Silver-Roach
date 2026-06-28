// Pure data, safe to import in client components. No secrets, no fetch.

export type MetalSymbol = "AU" | "AG" | "PT" | "PD" | "RH" | "CU" | "NI" | "AL" | "PB" | "ZN";

export const METALS: Record<string, { name: string; glyph: string; color: string }> = {
  AU: { name: "Gold", glyph: "Au", color: "#CBA135" },
  AG: { name: "Silver", glyph: "Ag", color: "#AEB7C2" },
  PT: { name: "Platinum", glyph: "Pt", color: "#CBD6DF" },
  PD: { name: "Palladium", glyph: "Pd", color: "#93A89B" },
  RH: { name: "Rhodium", glyph: "Rh", color: "#C9C2D6" },
  CU: { name: "Copper", glyph: "Cu", color: "#B5713A" },
  NI: { name: "Nickel", glyph: "Ni", color: "#A7B0AE" },
  AL: { name: "Aluminum", glyph: "Al", color: "#9AA3AC" },
  PB: { name: "Lead", glyph: "Pb", color: "#7E8794" },
  ZN: { name: "Zinc", glyph: "Zn", color: "#8FA0A8" },
};

// The four precious metals shown in the spot ticker by default.
export const TICKER_SYMBOLS: MetalSymbol[] = ["AU", "AG", "PT", "PD"];

export const ALL_SYMBOLS = Object.keys(METALS) as MetalSymbol[];
