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
      <head>
        {/* Both typefaces are served from Webflow's CDN — see lumos-tokens.css.
            Warming the connection avoids a visible fallback-to-Arial flash. */}
        <link rel="preconnect" href="https://cdn.prod.website-files.com" crossOrigin="anonymous" />
      </head>
      <body>
        {/* Rule 10 (1.3.1) — skip link must be the first focusable element, so it
            stays above the header rather than inside it. */}
        <a className="a11y_skip_link" href="#main">
          Skip to main content
        </a>

        {/* Chrome per design-inventory §1.1: a sticky 68px header. The same
            section specifies no footer on report or module screens, which is
            every screen in this app, so there deliberately is not one. Links out
            to the marketing site are plain anchors, not next/link — they leave
            the app and must not pick up the /app basePath. */}
        <header className="a11y_header">
          <div className="a11y_header_inner">
            <a className="a11y_header_brand" href="https://webyansh.com/">
              Webyansh
            </a>
            <nav className="a11y_header_nav" aria-label="Accessibility suite">
              <a href="https://webyansh.com/tools/color-contrast-checker">
                Contrast checker
              </a>
              <a href="https://webyansh.com/contact">Talk to us</a>
            </nav>
          </div>
        </header>

        <main id="main">{children}</main>
      </body>
    </html>
  );
}
