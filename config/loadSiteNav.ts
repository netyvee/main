// W-DASHBOARD render seam (D-003 shape). The CRM dashboard exports the operator's site
// settings (logo / navigation / footer / social) to content/site-settings.json; this loader
// merges them OVER the static config/site.ts defaults so a dashboard edit actually RENDERS in
// the shared Shell (header logo + nav + footer). When the file is absent, the static defaults
// stand (safe by construction). NAP (phone/email/address) is NEVER here — it stays in the page
// JSON `nap` block, so a cross-division value remains impossible.
import fs from 'fs';
import path from 'path';
import type { SiteNav, NavLink } from '@vigil/web-framework';
import { isNavLinkRel } from '@vigil/web-framework';
import { siteNav as base } from './site';

type ExportedSettings = {
  logo?: { src?: string; footerSrc?: string; alt?: string };
  social?: Record<string, string>;
  nav?: { label?: string; href?: string; rel?: string }[];
  footer?: {
    columns?: { heading?: string; links?: { label?: string; href?: string; rel?: string }[] }[];
    legal?: { label?: string; href?: string; rel?: string }[];
  };
};

// SM-F2 — ONE normalisation point for a link, so `rel` cannot be preserved in some
// placements and dropped in others (it was previously dropped in all four).
//
// `rel` is carried through a CLOSED ALLOW-LIST (isNavLinkRel), never copied across.
// This file reads JSON the CRM exported: at that boundary the value is `unknown` no
// matter what the TypeScript type claims, so an unrecognised or hostile `rel` must be
// DROPPED rather than trusted. Dropping is the safe direction — an unknown relationship
// renders as an ordinary link; carrying it would let a site assert a governed
// relationship the framework never defined.
function toNavLink(raw: { label?: string; href?: string; rel?: string } | undefined): NavLink | null {
  const label = (raw?.label ?? '').trim();
  const href = (raw?.href ?? '').trim();
  if (!label || !href) return null;
  const link: NavLink = { label, href };
  if (isNavLinkRel(raw?.rel)) link.rel = raw.rel;
  return link;
}

function readSettings(): ExportedSettings | null {
  try {
    const p = path.join(process.cwd(), 'content', 'site-settings.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as ExportedSettings;
  } catch {
    return null;
  }
}

export function loadSiteNav(): SiteNav {
  const s = readSettings();
  if (!s) return base;

  const merged: SiteNav = { ...base };

  if (s.logo?.src) {
    merged.logo = {
      src: s.logo.src,
      alt: s.logo.alt || base.logo?.alt || base.brandName,
      footerSrc: s.logo.footerSrc || s.logo.src,
    };
  }

  const nav = (s.nav ?? []).map(toNavLink).filter((l): l is NavLink => l !== null);
  if (nav.length) merged.primary = nav;

  const columns = (s.footer?.columns ?? [])
    .map((c) => ({
      heading: (c.heading ?? '').trim(),
      links: (c.links ?? []).map(toNavLink).filter((l): l is NavLink => l !== null),
    }))
    .filter((c) => c.heading);
  if (columns.length) merged.footer = columns;

  const legal = (s.footer?.legal ?? []).map(toNavLink).filter((l): l is NavLink => l !== null);
  if (legal.length) merged.legalLinks = legal;

  const social = Object.entries(s.social ?? {})
    .filter(([, v]) => v)
    .map(([label, href]) => ({ label, href: String(href) }));
  if (social.length) merged.social = social;

  return merged;
}
