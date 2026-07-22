// Shared FormData parsing/validation for holding add/edit forms — used by the
// real server actions and by the demo dashboard's local (unsaved) mutations.
import { METALS } from "@/lib/metals-meta";
import { UNIT_TO_OZT } from "@/lib/units";

export function readHoldingFields(formData: FormData) {
  const symbol = String(formData.get("symbol") || "");
  const unit = String(formData.get("unit") || "");
  const weight = parseFloat(String(formData.get("weight") || ""));
  const quantityRaw = String(formData.get("quantity") || "1");
  const quantity = quantityRaw ? parseInt(quantityRaw, 10) : 1;
  const purityRaw = String(formData.get("purity") || "1");
  const purity = purityRaw ? parseFloat(purityRaw) : 1;

  const noteRaw = String(formData.get("note") || "").trim();
  const note = noteRaw ? noteRaw.slice(0, 280) : null;

  if (!METALS[symbol]) throw new Error("Unknown metal");
  if (!(unit in UNIT_TO_OZT)) throw new Error("Unknown unit");
  if (!Number.isFinite(weight) || weight <= 0) throw new Error("Weight must be greater than 0");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive whole number");
  if (!Number.isFinite(purity) || purity <= 0 || purity > 1) throw new Error("Purity must be between 0 and 1");

  return { symbol, unit, weight, quantity, purity, note };
}
