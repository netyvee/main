import { withVigilSecurity } from '@vigil/web-framework/config/security.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The framework ships raw TypeScript (`"main": "src/index.ts"`, no build step), so
  // every consumer must transpile it. Same as care/staffing.
  transpilePackages: ['@vigil/web-framework'],

  // TRAILING SLASH — a real cutover decision, recorded here rather than defaulted.
  // The live WordPress root ENFORCES a trailing slash (301 /about-x -> /about-x/),
  // while all four Vercel subdomains STRIP it (308). The estate is therefore already
  // inconsistent (M-11). This site follows the Next.js/Vercel convention the rest of
  // the estate uses, and the legacy slashed URLs get 301s at cutover — chosen so the
  // corporate site matches its own subdomains rather than preserving a convention
  // that only the outgoing WordPress install used.
  trailingSlash: false,

  images: {
    remotePatterns: [
      // Cloudinary is the CRM's canonical image store for every site.
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },

  // No redirects yet. The legacy -> new URL map is built at cutover from the union of
  // the Rank Math sitemap, a live crawl, and Google Search Console indexed pages
  // (GSC access is an open founder gate, MAIN-G1). Hand-typing it would miss orphan
  // ranking pages, which is precisely how migrations lose traffic.
};

// withVigilSecurity() applies the shared CSP/HSTS/frame/nosniff header set (framework
// v0.4.7+). care has to inline 55 lines of this because its pin predates the helper —
// scaffolding at v0.4.10 means this site never inherits that debt.
// MAIN-ANALYTICS-01 (D-103): allow consent-gated GA4 (G-KTH8TMCHTT) in the CSP. GA4 still loads ONLY after
// an active Accept (the CookieConsent gate) — the CSP merely PERMITS it; it does not load it. Scoped to
// script-src (gtag.js) + connect-src/img-src (collect endpoints) so nothing else is widened.
export default withVigilSecurity(nextConfig, {
  scriptHosts: ['https://www.googletagmanager.com'],
  connectHosts: ['https://www.google-analytics.com', 'https://region1.google-analytics.com'],
  imgHosts: ['https://www.google-analytics.com'],
});
