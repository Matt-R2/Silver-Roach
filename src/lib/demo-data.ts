// Sample portfolio shown on /demo. Matches the composition used in the
// landing page hero mockup so the numbers feel consistent site-wide.
import type { HoldingInput } from "@/lib/portfolio";

export const DEMO_HOLDINGS: HoldingInput[] = [
  { id: "demo-au", symbol: "AU", weight: 15, unit: "ozt", quantity: 1, purity: 1, nickname: "Eagles", note: null },
  { id: "demo-ag", symbol: "AG", weight: 200, unit: "ozt", quantity: 1, purity: 1, nickname: "Bars", note: null },
  { id: "demo-pt", symbol: "PT", weight: 1, unit: "ozt", quantity: 1, purity: 1, nickname: null, note: null },
  { id: "demo-pd", symbol: "PD", weight: 1, unit: "ozt", quantity: 1, purity: 1, nickname: null, note: null },
];
