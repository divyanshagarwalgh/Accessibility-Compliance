import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Accessibility & Compliance Suite — Webyansh",
    template: "%s — Webyansh",
  },
  description:
    "Scan any page against WCAG 2.1 and 2.2 AA and get the exact fix for each issue in Webflow Designer.",
  // Surface C is the application layer. Surface A (/tools/*) carries the SEO.
  robots: { index: false, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Rule 11 (3.1.1 Language of Page).
    <html lang="en">
      <body>
        {/* Rule 10 (1.3.1) — skip link must be the first focusable element. */}
        <a className="a11y_skip_link" href="#main">
          Skip to main content
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
