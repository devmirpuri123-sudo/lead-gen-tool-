import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SACVIN Global Plastics Lead Engine",
  description:
    "Internal semi-automated lead-generation system for SACVIN Nigeria Limited and Veeglow Engineering Solutions",
  robots: { index: false, follow: false }, // internal tool — never to be indexed
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
