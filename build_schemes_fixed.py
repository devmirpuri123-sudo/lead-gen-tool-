#!/usr/bin/env python3
"""Generate a ranked CSV tracker for 2027 graduate schemes."""

from __future__ import annotations

import argparse
import csv
from dataclasses import asdict, dataclass, field

TIER_BANDS = ((8, "Tier 1"), (6, "Tier 2"), (0, "Tier 3"))

COLUMNS = [
    ("company", "Company"),
    ("programme", "Programme name"),
    ("sector", "Sector"),
    ("locations", "Locations mentioned"),
    ("website", "Website (careers page)"),
    ("linkedin", "LinkedIn company page"),
    ("why_fit", "Why I fit"),
    ("technical_angle", "Technical angle"),
    ("timing", "Application timing"),
    ("fit_score", "Fit score (1-10)"),
    ("tier", "Priority tier"),
    ("status", "Status"),
    ("notes", "Notes"),
]


@dataclass
class Scheme:
    company: str
    programme: str
    sector: str
    locations: str
    website: str
    linkedin: str
    why_fit: str
    technical_angle: str
    timing: str
    fit_score: int
    notes: str
    status: str = "Not started"
    tier: str = field(init=False)

    def __post_init__(self) -> None:
        self.tier = next(
            tier for floor, tier in TIER_BANDS if self.fit_score >= floor
        )


SCHEMES = [
    Scheme(
        "Standard Chartered",
        "International Graduate Programme (Trade Finance / Corporate Banking) 2027",
        "Trade Finance-Banking",
        "London; focus on Africa, Asia and Middle East",
        "https://www.sc.com/en/careers/",
        "https://www.linkedin.com/company/standard-chartered-bank",
        "Sacvin's Africa trade exposure, languages and international experience fit cross-border corporate banking.",
        "Use Python for trade-flow and counterparty analysis; prepare a one-page Africa export-corridor analysis.",
        "Typically opens autumn 2026; verify the live opening.",
        9,
        "Strongest narrative fit. Confirm UK visa sponsorship before investing heavily.",
    ),
    Scheme(
        "Revolut",
        "Graduate Programme 2027 (Product / Operations / Growth / Risk)",
        "Tech-Fintech",
        "London; Lisbon; Madrid; Krakow; Dubai",
        "https://www.revolut.com/careers",
        "https://www.linkedin.com/company/revolut",
        "International profile, languages and commercial experience suit growth, operations and risk roles.",
        "Strengthen SQL joins, window functions and Python; show a shipped automation or analytics project.",
        "Usually late summer/autumn 2026; verify the live opening.",
        9,
        "Expect numerical and logical testing. Practise before starting the assessment.",
    ),
    Scheme(
        "HSBC",
        "Global Graduate Programme (International Banking / Trade & Receivables Finance) 2027",
        "Trade Finance-Banking",
        "London; international network including Iberia and Asia",
        "https://www.hsbc.com/careers/",
        "https://www.linkedin.com/company/hsbc",
        "Languages and cross-border experience support international banking and trade-finance client work.",
        "Frame Python as process automation and reporting improvement, not generic data science.",
        "Usually September-October 2026; verify the live opening.",
        8,
        "Apply early if recruitment is rolling. Confirm right-to-work requirements.",
    ),
    Scheme(
        "Unilever",
        "Future Leaders Programme (Marketing / Sales / Supply Chain) 2027",
        "Marketing-FMCG",
        "London; major EU hubs including Spain and Portugal",
        "https://www.unilever.com/careers/",
        "https://www.linkedin.com/company/unilever",
        "Languages plus sales and digital-marketing experience in manufacturing fit customer development and marketing.",
        "Use Python for campaign, category or sales analysis; choose one track deliberately.",
        "Typically September-October 2026; verify the live opening.",
        8,
        "Check Spain and Portugal opportunities as well as the UK. Verify sponsorship and eligibility.",
    ),
    Scheme(
        "TikTok",
        "Graduate Programme 2027 (Product / Trust & Safety / Content Operations / Ads)",
        "Tech-Fintech",
        "London; Dublin; Berlin; Madrid; Lisbon",
        "https://www.tiktok.com/careers",
        "https://www.linkedin.com/company/tiktok",
        "Multilingual capability and digital marketing experience fit content, ads and market roles.",
        "Python and SQL support ads measurement, product analytics and trust-and-safety analytics.",
        "Typically August-October 2026; verify the live opening.",
        8,
        "Monitor language-specific roles separately. Understand the nature of trust-and-safety work.",
    ),
    Scheme(
        "L'Oreal",
        "Brandstorm / Management Trainee Programme (Marketing) 2027",
        "Marketing-FMCG",
        "London; Paris; Madrid; Lisbon",
        "https://www.loreal.com/en/careers/students-and-graduates/",
        "https://www.linkedin.com/company/l'oreal",
        "Creative, international and digital-marketing experience fits marketing and Beauty Tech roles.",
        "A coded prototype or automation project can demonstrate the Beauty Tech angle.",
        "Usually autumn 2026; verify the live opening.",
        7,
        "Check Brandstorm separately; Madrid and Lisbon roles may require local-language fluency.",
    ),
    Scheme(
        "Citi",
        "International Graduate Programme (Trade Finance / Markets / Corporate Banking) 2027",
        "Trade Finance-Banking",
        "London; major hubs across Europe and globally",
        "https://www.citi.com/careers",
        "https://www.linkedin.com/company/citi",
        "Trade-finance, corporate-banking and cross-border client coverage fit the international profile.",
        "Prioritise Treasury & Trade Solutions and Corporate Banking; Python supports the analytical story.",
        "Typically August-October 2026; verify the live opening.",
        7,
        "Add a short finance primer to the CV and confirm office-specific eligibility.",
    ),
    Scheme(
        "Diageo",
        "Commercial / Marketing Graduate Programme 2027",
        "Marketing-FMCG",
        "London; major European and LatAm exposure",
        "https://www.diageo.com/en/working-for-us",
        "https://www.linkedin.com/company/diageo",
        "Iberian and Lusophone languages plus African-market experience support commercial roles.",
        "Discuss revenue-growth management: pricing, mix and promotional effectiveness.",
        "Typically September-October 2026; verify the live opening.",
        7,
        "Portuguese is relevant to Brazil and Africa. Emphasise commercial results.",
    ),
    Scheme(
        "McKinsey & Company",
        "Business Analyst / Associate (2027 intake)",
        "Consulting",
        "London; Madrid; other European offices",
        "https://www.mckinsey.com/careers",
        "https://www.linkedin.com/company/mckinsey",
        "Languages, international study and commercial experience create a distinctive cross-border profile.",
        "Python helps support an analytics or QuantumBlack narrative, but case preparation remains decisive.",
        "May open late summer 2026; verify immediately.",
        6,
        "Apply, but cap preparation time. Madrid may be a more natural office angle than London.",
    ),
    Scheme(
        "BCG (Boston Consulting Group)",
        "Associate / Consultant (2027)",
        "Consulting",
        "London; Madrid; other EU hubs",
        "https://www.bcg.com/careers",
        "https://www.linkedin.com/company/boston-consulting-group",
        "Multilingual, cross-cultural and B2B-commercial experience supports EMEA consulting.",
        "BCG X is the most relevant technical route; Python is supporting evidence for generalist roles.",
        "Usually late summer/early autumn 2026; verify the live opening.",
        6,
        "Reuse McKinsey case preparation. Confirm office and language requirements.",
    ),
    Scheme(
        "Deloitte",
        "Strategy & Operations / Technology & Analytics Consulting Graduate Programme 2027",
        "Consulting",
        "London; Manchester; European offices",
        "https://www2.deloitte.com/global/en/pages/careers/topics/students-and-graduates.html",
        "https://www.linkedin.com/company/deloitte",
        "Sacvin operations and sales experience maps onto strategy, transformation and analytics work.",
        "Prioritise Technology & Transformation or Analytics tracks where Python is more directly useful.",
        "Often August-September 2026; many roles rolling; verify the live opening.",
        6,
        "Large intake makes this a realistic consulting target. Apply early if rolling.",
    ),
    Scheme(
        "Reckitt",
        "Commercial / Marketing Graduate Scheme 2027",
        "Marketing-FMCG",
        "London; strong international footprint",
        "https://www.reckitt.com/careers/",
        "https://www.linkedin.com/company/reckitt",
        "Sales and digital marketing within manufacturing transfers directly to commercial roles.",
        "Use a concrete Sacvin data or sales example to demonstrate analytical reasoning.",
        "Usually autumn 2026; verify the live opening.",
        6,
        "Check whether the scheme is UK-only or includes Iberian markets.",
    ),
    Scheme(
        "PwC",
        "Strategy& / Technology Consulting Graduate Programme 2027",
        "Consulting",
        "London; other UK cities; European network",
        "https://www.pwc.com/gx/en/careers/students-and-graduates.html",
        "https://www.linkedin.com/company/pwc",
        "Communication, commercial insight and languages support cross-border consulting.",
        "Technology and Data Consulting may offer a better fit than the most competitive Strategy& route.",
        "Typically late summer/autumn 2026; verify the live opening.",
        5,
        "Confirm right-to-work requirements and whether multiple tracks can be submitted.",
    ),
    Scheme(
        "Oliver Wyman",
        "Consultant 2027",
        "Consulting",
        "London; European offices",
        "https://www.oliverwyman.com/en/careers/students-and-graduates.html",
        "https://www.linkedin.com/company/oliver-wyman",
        "Distinctive international profile and multilingualism support EMEA work.",
        "Python helps with the quant narrative, but expect a demanding quantitative screen.",
        "Often August-September 2026; verify the live opening.",
        5,
        "Treat as a bonus application once core case preparation is underway.",
    ),
    Scheme(
        "Kearney",
        "Business Analyst 2027",
        "Consulting",
        "London; European offices",
        "https://www.kearney.com/careers",
        "https://www.linkedin.com/company/kearney",
        "Languages and B2B sales experience fit operations, supply chain and consumer-goods practices.",
        "Connect Python to the Sacvin manufacturing and operations context.",
        "Usually late summer 2026; verify the live opening.",
        4,
        "Submit as a bonus application using shared case preparation.",
    ),
]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="target_graduate_schemes_2027.csv")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3])
    parser.add_argument("--sector", help="Filter by sector substring")
    args = parser.parse_args(argv)

    rows = sorted(SCHEMES, key=lambda scheme: (-scheme.fit_score, scheme.company))
    if args.tier:
        rows = [scheme for scheme in rows if scheme.tier == f"Tier {args.tier}"]
    if args.sector:
        rows = [scheme for scheme in rows if args.sector.lower() in scheme.sector.lower()]

    with open(args.out, "w", newline="", encoding="utf-8-sig") as output:
        writer = csv.writer(output)
        writer.writerow([label for _, label in COLUMNS])
        for scheme in rows:
            data = asdict(scheme)
            writer.writerow([data[key] for key, _ in COLUMNS])

    print(f"{len(rows)} rows -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
