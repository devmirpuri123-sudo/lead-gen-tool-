export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-GB").format(n);
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "$" + new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export const UNKNOWN_LABEL = "Unknown — requires research";

export function orUnknown(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return UNKNOWN_LABEL;
  return String(v);
}

export function tierBadgeClass(tier: string): string {
  switch (tier) {
    case "Tier 1 - Priority":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Tier 2 - Develop":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "Tier 3 - Monitor":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "Tier 4 - Deprioritise":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-slate-100 text-slate-500 border-slate-200";
  }
}
