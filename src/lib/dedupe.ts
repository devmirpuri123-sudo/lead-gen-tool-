/** Duplicate detection for companies.
 *
 * Two levels:
 *  - normalizeName: lowercase, punctuation stripped — an exact match here is a
 *    DUPLICATE (blocked on manual entry unless overridden; skipped on import).
 *  - coreName: normalizeName with legal/common suffix words removed
 *    ("Acme Ltd" ~ "Acme Limited") — a match here is a POSSIBLE duplicate
 *    (warned, not blocked).
 *  - a matching website domain is always a DUPLICATE.
 */

const SUFFIX_WORDS = new Set([
  "limited", "ltd", "llc", "inc", "incorporated", "plc", "gmbh", "sarl", "srl",
  "bv", "nv", "pty", "co", "company", "corp", "corporation", "sa", "ag", "ab",
  "oy", "llp", "lp", "fze", "fzc", "fzco", "enterprises", "enterprise",
  "trading", "group", "international", "intl", "global", "holdings",
]);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function coreName(name: string): string {
  const words = normalizeName(name).split(" ").filter((w) => !SUFFIX_WORDS.has(w));
  // If stripping suffixes removes everything ("Trading Co Ltd"), keep the full form.
  return words.length > 0 ? words.join(" ") : normalizeName(name);
}

/** Extract a comparable domain from a URL or bare domain; null if unusable. */
export function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  let s = website.trim().toLowerCase();
  if (s === "") return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = s.split(/[/?#]/)[0];
  if (!host.includes(".")) return null;
  return host;
}

export interface DuplicateVerdict {
  level: "duplicate" | "possible" | "none";
  reason: string | null;
  matchId: number | null;
  matchName: string | null;
}

export interface ExistingCompany {
  id: number;
  name: string;
  name_normalised: string;
  website: string | null;
}

export function checkDuplicate(
  name: string,
  website: string | null,
  existing: ExistingCompany[]
): DuplicateVerdict {
  const norm = normalizeName(name);
  const core = coreName(name);
  const domain = domainOf(website);
  for (const e of existing) {
    if (domain && domainOf(e.website) === domain) {
      return { level: "duplicate", reason: `same website domain (${domain})`, matchId: e.id, matchName: e.name };
    }
    if (e.name_normalised === norm) {
      return { level: "duplicate", reason: "same name", matchId: e.id, matchName: e.name };
    }
  }
  for (const e of existing) {
    if (coreName(e.name) === core) {
      return {
        level: "possible",
        reason: `similar name ignoring suffixes like Ltd/Trading/Group ("${e.name}")`,
        matchId: e.id,
        matchName: e.name,
      };
    }
  }
  return { level: "none", reason: null, matchId: null, matchName: null };
}
