/** Outreach draft templates.
 *
 * Drafts are generated OFFLINE from these fixed templates using only facts on
 * file. Anything not known is inserted as a loud [BRACKETED PLACEHOLDER] the
 * human reviewer must resolve before approving — nothing is ever invented,
 * and nothing is ever sent by the system.
 */

export interface TemplateContext {
  contact_name: string | null;
  company_name: string;
  company_type: string | null;
  market_country: string | null;
  description: string | null;
}

export interface OutreachTemplate {
  key: string;
  channel: "email" | "linkedin";
  label: string;
  hint: string;
  subject?: (ctx: TemplateContext) => string;
  body: (ctx: TemplateContext) => string;
}

function firstName(ctx: TemplateContext): string {
  if (!ctx.contact_name) return "[CONTACT NAME — Unknown, requires research]";
  return ctx.contact_name.split(" ")[0];
}

function partnerWord(ctx: TemplateContext): string {
  return ctx.company_type ?? "[PARTNER TYPE — confirm: distributor / wholesaler / importer / retailer]";
}

function countryWord(ctx: TemplateContext): string {
  return ctx.market_country ?? "[COUNTRY — link this company to a market first]";
}

const SIGNATURE = `[YOUR NAME]
[YOUR ROLE]
SACVIN Nigeria Limited / Veeglow Engineering Solutions
[YOUR EMAIL AND PHONE]`;

export const TEMPLATES: OutreachTemplate[] = [
  {
    key: "email_intro",
    channel: "email",
    label: "Email — first introduction",
    hint: "A short, honest first email to a potential trade partner.",
    subject: (ctx) => `Plastics supply partnership — SACVIN Nigeria x ${ctx.company_name}`,
    body: (ctx) => `Dear ${firstName(ctx)},

I am writing from SACVIN Nigeria Limited, a plastics manufacturer based in Nigeria. We produce household and packaging plasticware (HS 3923/3924) and are building trade partnerships in ${countryWord(ctx)}.

We came across ${ctx.company_name} as a ${partnerWord(ctx)} in your market${ctx.description ? ` — we understand you ${ctx.description.length > 120 ? "[SUMMARISE THEIR BUSINESS IN ONE LINE FROM THE DESCRIPTION ON FILE]" : ctx.description.charAt(0).toLowerCase() + ctx.description.slice(1)}` : ""}. We would value a short conversation about whether our range could fit your portfolio.

[PRODUCT SPECIFICS — add 1-2 lines about the exact products, MOQs and pricing basis you want to lead with]

Would you be open to a brief call or an exchange by email? I am happy to send our catalogue and export references.

Kind regards,
${SIGNATURE}`,
  },
  {
    key: "email_followup",
    channel: "email",
    label: "Email — polite follow-up",
    hint: "Follow-up if there has been no reply to the introduction.",
    subject: (ctx) => `Following up — SACVIN Nigeria x ${ctx.company_name}`,
    body: (ctx) => `Dear ${firstName(ctx)},

I wanted to follow up briefly on my earlier note about a possible plastics supply partnership between SACVIN Nigeria Limited and ${ctx.company_name}.

[REFERENCE THE FIRST EMAIL — when was it sent, and anything that has changed since]

If the timing is not right, a quick reply saying so is equally welcome — I will not keep chasing.

Kind regards,
${SIGNATURE}`,
  },
  {
    key: "linkedin_connection",
    channel: "linkedin",
    label: "LinkedIn — connection request note",
    hint: "Max ~300 characters. Sent by you manually from your own LinkedIn account.",
    body: (ctx) => `Hello ${firstName(ctx)} — I'm with SACVIN Nigeria Limited, a plastics manufacturer exploring partnerships with ${partnerWord(ctx)}s in ${countryWord(ctx)}. I'd value connecting to share what we make. — [YOUR NAME]`,
  },
  {
    key: "linkedin_message",
    channel: "linkedin",
    label: "LinkedIn — message after connecting",
    hint: "Sent manually after they accept your connection request.",
    body: (ctx) => `Thank you for connecting, ${firstName(ctx)}.

As mentioned, SACVIN Nigeria Limited manufactures household and packaging plasticware (HS 3923/3924) in Nigeria, and we are looking for partners like ${ctx.company_name} in ${countryWord(ctx)}.

[PRODUCT SPECIFICS — one or two lines on the range and terms you want to lead with]

If it is of interest I can send our catalogue by email — what address is best? And if it is not a fit, no problem at all.

Best regards,
[YOUR NAME]`,
  },
];

export function getTemplate(key: string): OutreachTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

/** Placeholders still present in a draft — must be resolved before approval. */
export function findPlaceholders(text: string): string[] {
  return [...new Set((text.match(/\[[^\]]{3,120}\]/g) ?? []))];
}
