import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SACVIN Global Plastics Lead Engine",
  description:
    "Internal semi-automated lead-generation system for SACVIN Nigeria Limited and Veeglow Engineering Solutions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="bg-slate-900 text-white">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
            <Link href="/" className="font-semibold tracking-wide">
              SACVIN <span className="text-emerald-400">Global Plastics</span> Lead Engine
            </Link>
            <nav className="flex gap-5 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">Dashboard</Link>
              <Link href="/markets" className="hover:text-white">Markets</Link>
              <Link href="/scoring" className="hover:text-white">Scoring</Link>
              <Link href="/settings/scoring" className="hover:text-white">Configuration</Link>
              <Link href="/companies" className="hover:text-white">Companies</Link>
              <Link href="/leads" className="hover:text-white">Leads</Link>
              <span className="text-slate-500" title="Phase 4">Outreach</span>
              <span className="text-slate-500" title="Phase 5">Reports</span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-400 border-t border-slate-200 mt-8">
          Internal tool — SACVIN Nigeria Limited &amp; Veeglow Engineering Solutions. Data is planning-grade:
          estimates and imported figures must be verified before external use. No messages are ever sent
          automatically; all outreach is human-reviewed and sent manually.
        </footer>
      </body>
    </html>
  );
}
