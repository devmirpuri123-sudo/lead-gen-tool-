import type { LeadListRow } from "@/lib/crmQueries";

/** Deterministic next-action recommendation for a lead. Rules are ordered:
 *  the first that applies wins. Every recommendation says WHY. */

export interface LeadContext {
  lead: LeadListRow;
  hasDraftInReview: boolean;
  hasApprovedDraft: boolean;
  overdueReminder: { description: string | null; due_at: string } | null;
  nextReminder: { description: string | null; due_at: string } | null;
}

export interface NextAction {
  action: string;
  reason: string;
  href: string | null;
  urgent: boolean;
}

export function recommendNextAction(ctx: LeadContext): NextAction {
  const { lead } = ctx;
  const companyHref = lead.company_id ? `/companies/${lead.company_id}` : null;
  const leadHref = `/leads/${lead.id}`;

  if (lead.status === "Do not contact") {
    return {
      action: "No action — do not contact",
      reason: "This lead is marked Do not contact. The system will not generate drafts for it, and no outreach of any kind may be made.",
      href: null,
      urgent: false,
    };
  }
  if (lead.status === "Closed" || lead.status === "Not a fit") {
    return {
      action: "None — lead is closed",
      reason: `Status is "${lead.status}". Reopen it (change status) only if something material has changed.`,
      href: null,
      urgent: false,
    };
  }
  if (ctx.overdueReminder) {
    return {
      action: "Follow up now — reminder overdue",
      reason: `"${ctx.overdueReminder.description ?? "Follow-up"}" was due ${ctx.overdueReminder.due_at.slice(0, 10)}.`,
      href: leadHref,
      urgent: true,
    };
  }

  const researchGaps: string[] = [];
  if (!lead.market_country) researchGaps.push("link the company to a country");
  if (!lead.company_type) researchGaps.push("confirm the company type");
  if (!lead.website) researchGaps.push("find the website");
  if (!lead.contact_name) researchGaps.push("identify a contact person");
  if (!lead.contact_email) researchGaps.push("find a contact email");

  if (["New", "Imported", "Needs research"].includes(lead.status)) {
    if (researchGaps.length > 0) {
      return {
        action: "Complete the research",
        reason: `Before outreach: ${researchGaps.join(", ")}. Then move the lead to Reviewed.`,
        href: companyHref,
        urgent: false,
      };
    }
    return {
      action: "Review and qualify",
      reason: "Research looks complete — review the company and move the lead to Reviewed (or Not a fit).",
      href: leadHref,
      urgent: false,
    };
  }

  if (lead.market_country && !lead.market_tier) {
    return {
      action: "Score the market",
      reason: `${lead.market_country} has no weighted score yet, so this lead can't be prioritised properly. Enter Market Size, Access Ease and Competition on the Scoring workspace.`,
      href: "/scoring",
      urgent: false,
    };
  }

  if (ctx.hasApprovedDraft) {
    return {
      action: "Send the approved draft manually",
      reason: "An approved draft is waiting. Send it yourself from your own email/LinkedIn account, then mark it sent so the follow-up reminder is created.",
      href: leadHref,
      urgent: true,
    };
  }
  if (ctx.hasDraftInReview) {
    return {
      action: "Review the outreach draft",
      reason: "A draft exists but has not been approved. Resolve every [PLACEHOLDER], edit the text, then approve it.",
      href: leadHref,
      urgent: false,
    };
  }

  if (["Reviewed", "Cold", "Approved for outreach"].includes(lead.status)) {
    if (!lead.contact_email && !lead.contact_name) {
      return {
        action: "Find a contact before outreach",
        reason: "There is no named contact or email on file — outreach needs a real, researched recipient.",
        href: companyHref,
        urgent: false,
      };
    }
    return {
      action: "Generate an outreach draft",
      reason: `The lead is "${lead.status}" with a contact on file — create a draft from a template, review it, and approve it.`,
      href: leadHref,
      urgent: false,
    };
  }

  if (lead.status === "Contacted") {
    if (!ctx.nextReminder) {
      return {
        action: "Set a follow-up reminder",
        reason: "Outreach was sent but no follow-up is scheduled — set one so the lead doesn't go quiet.",
        href: leadHref,
        urgent: false,
      };
    }
    return {
      action: "Wait for the follow-up date",
      reason: `Next follow-up "${ctx.nextReminder.description ?? "Follow-up"}" is due ${ctx.nextReminder.due_at.slice(0, 10)}.`,
      href: leadHref,
      urgent: false,
    };
  }

  if (["Engaged", "Replied"].includes(lead.status)) {
    return {
      action: "Respond and advance",
      reason: "They are engaging — reply promptly, record what happened in the activity log, and consider moving the lead to Warm.",
      href: leadHref,
      urgent: true,
    };
  }
  if (lead.status === "Warm") {
    return {
      action: "Push toward qualification",
      reason: "The lead is warm — discuss volumes, pricing and terms, and move to Qualified when they fit.",
      href: leadHref,
      urgent: false,
    };
  }
  if (lead.status === "Qualified") {
    return {
      action: "Book a meeting",
      reason: "The lead is qualified — propose a call or meeting and record it when booked.",
      href: leadHref,
      urgent: false,
    };
  }
  if (lead.status === "Meeting booked") {
    return {
      action: "Prepare for the meeting",
      reason: "Review everything on file (research checklist, notes, market data) before the meeting, and log the outcome afterwards.",
      href: companyHref,
      urgent: false,
    };
  }
  if (lead.status === "Nurture") {
    return {
      action: "Schedule a light check-in",
      reason: ctx.nextReminder
        ? `Next check-in due ${ctx.nextReminder.due_at.slice(0, 10)}.`
        : "The lead is parked in Nurture — set a reminder a few months out so it isn't forgotten.",
      href: leadHref,
      urgent: false,
    };
  }
  return {
    action: "Review the lead",
    reason: `Status "${lead.status}" — check the activity log and decide the next step.`,
    href: leadHref,
    urgent: false,
  };
}
