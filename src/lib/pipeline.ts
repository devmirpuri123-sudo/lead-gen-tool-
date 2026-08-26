/** The 16-status lead pipeline, in journey order. */
export const LEAD_STATUSES = [
  "New",
  "Imported",
  "Needs research",
  "Reviewed",
  "Cold",
  "Approved for outreach",
  "Contacted",
  "Engaged",
  "Replied",
  "Warm",
  "Qualified",
  "Meeting booked",
  "Nurture",
  "Not a fit",
  "Do not contact",
  "Closed",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Stage groupings for display. */
export const STATUS_STAGES: { stage: string; statuses: LeadStatus[] }[] = [
  { stage: "Intake", statuses: ["New", "Imported", "Needs research", "Reviewed"] },
  { stage: "Cold outreach", statuses: ["Cold", "Approved for outreach", "Contacted"] },
  { stage: "Engaging", statuses: ["Engaged", "Replied", "Warm"] },
  { stage: "Advanced", statuses: ["Qualified", "Meeting booked"] },
  { stage: "Parked", statuses: ["Nurture", "Not a fit", "Do not contact", "Closed"] },
];

export function statusBadgeClass(status: string): string {
  if (["New", "Imported", "Needs research", "Reviewed"].includes(status))
    return "bg-slate-100 text-slate-600 border-slate-200";
  if (["Cold", "Approved for outreach", "Contacted"].includes(status))
    return "bg-sky-100 text-sky-800 border-sky-200";
  if (["Engaged", "Replied", "Warm"].includes(status))
    return "bg-amber-100 text-amber-800 border-amber-200";
  if (["Qualified", "Meeting booked"].includes(status))
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "Do not contact") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-violet-100 text-violet-800 border-violet-200"; // Nurture, Not a fit, Closed
}

/** Company types we target, most valuable first. */
export const COMPANY_TYPES = ["distributor", "wholesaler", "importer", "retailer", "other"] as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
