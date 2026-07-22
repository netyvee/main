// Corporate main site — NAVIGATION STRUCTURE only.
//
// NAP (phone/email/address/trading_name) is NEVER here: it comes from the page JSON
// `nap` block, which the CRM builds from config/sites.php via SiteRegistry. That is
// what makes cross-division phone contamination impossible by construction.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE DIVISION RULES INVERT ON THIS SITE. On cleaning/security/care/staffing,
// linking to another division is FORBIDDEN. Here it is the entire point: this is
// the parent-company front door and presenting all four businesses is correct
// (D-033; the CRM's SiteSettingsService already exempts `main` from the
// cross-division link ban). This is the ONE site where inter-business links belong.
//
// Equally, this is the ONLY site where the legal entity and company number appear
// in full by design — Vigil Services Ltd, Company Reg. 11756806.
// ─────────────────────────────────────────────────────────────────────────────
//
// NO SINGLE DIVISION PHONE. Deliberate. The live WordPress site currently shows
// 020 3973 8887 as its corporate number — that is the CARE STAFFING division
// number, not a corporate one. Presenting it here would be a genuine cross-division
// NAP leak on the group's own site. The corporate contact number is a founder
// decision and is recorded as an open gate (M-14); until it is answered, this site
// presents the corporate email only.
import type { SiteNav } from '@vigil/web-framework';

export const siteNav: SiteNav = {
  brandName: 'Vigil Services Ltd',
  // MAIN-HOMEPAGE-VISUAL-02 — the reference header nav: Divisions + Contact (on-page anchors),
  // plus a direct "Get in touch" mailto CTA (below). NO About (there is no standalone About page).
  // The four division destinations are NOT nav items here — they are the image-led gateway cards
  // (division_image_gateway), which "Divisions" scrolls to. This keeps the outbound cross-division
  // links (the one site where they are allowed) in the gateway, exactly as the reference presents.
  primary: [
    { label: 'Divisions', href: '/#divisions' },
    { label: 'Contact', href: '/#contact' },
  ],
  // Corporate front door has no sales funnel (empty enquiry_url, C-12/MAIN-G3); the header CTA is a
  // direct email. Email-only is the approved corporate contact until M-14 (corporate phone) is decided.
  cta: { label: 'Get in touch', href: 'mailto:info@vigilservices.co.uk' },
  logo: { src: '/logo.svg', alt: 'Vigil Services Ltd', footerSrc: '/logo-white.svg' },
  copyright: true,
  footer: [
    {
      heading: 'Our businesses',
      links: [
        { label: 'Vigil Cleaning Services', href: 'https://cleaning.vigilservices.co.uk/' },
        { label: 'Vigil Security Services', href: 'https://security.vigilservices.co.uk/' },
        { label: 'Vigil Care Services', href: 'https://care.vigilservices.co.uk/' },
        { label: 'Vigil Care Staffing', href: 'https://staffing.vigilservices.co.uk/' },
      ],
    },
  ],
  // MAIN-G5 (2026-07-22): main now has its OWN legal pages — a founder-approved privacy notice
  // and cookie notice (D-102 re-scope: privacy + cookie are the required set; modern-slavery is not
  // statutorily required at < £36m turnover; terms/accessibility are recommended, not blockers). The
  // footer links to main's own pages, NOT the staffing subdomain's. Modern-slavery/equal-opportunities
  // remain division-owned. Terms/accessibility can be added later without blocking cutover.
  legalLinks: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Cookies', href: '/cookies' },
  ],
  companyReg: 'Company Reg. 11756806',
  // No enquiry CTA label: `main.enquiry_url` is deliberately empty after closing
  // C-12 (it used to funnel the whole group into /enquire/cleaning). What replaces
  // it — one general inbox vs a "choose a business" hand-off — is gate MAIN-G3.
};
