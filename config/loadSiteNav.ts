// W-DASHBOARD render seam (D-003 shape). The CRM dashboard exports the operator's site
// settings (logo / navigation / footer / social) to content/site-settings.json; this loader
// merges them OVER the static config/site.ts defaults so a dashboard edit actually RENDERS in
// the shared Shell (header logo + nav + footer). When the file is absent, the static defaults
// stand (safe by construction). NAP (phone/email/address) is NEVER here — it stays in the page
// JSON `nap` block, so a cross-division value remains impossible.
import fs from 'fs';
import path from 'path';
import type { SiteNav } from '@vigil/web-framework';
import { siteNav as base } from './site';

type ExportedSettings = {
  logo?: { src?: string; footerSrc?: string; alt?: string };
  social?: Record<string, string>;
  nav?: { label?: string; href?: string }[];
  footer?: {
    columns?: { heading?: string; links?: { label?: string; href?: string }[] }[];
    legal?: { label?: string; href?: string }[];
  };
};

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

  const nav = (s.nav ?? [])
    .map((i) => ({ label: (i.label ?? '').trim(), href: (i.href ?? '').trim() }))
    .filter((l) => l.label && l.href);
  if (nav.length) merged.primary = nav;

  const columns = (s.footer?.columns ?? [])
    .map((c) => ({
      heading: (c.heading ?? '').trim(),
      links: (c.links ?? [])
        .map((l) => ({ label: (l.label ?? '').trim(), href: (l.href ?? '').trim() }))
        .filter((l) => l.label && l.href),
    }))
    .filter((c) => c.heading);
  if (columns.length) merged.footer = columns;

  const legal = (s.footer?.legal ?? [])
    .map((l) => ({ label: (l.label ?? '').trim(), href: (l.href ?? '').trim() }))
    .filter((l) => l.label && l.href);
  if (legal.length) merged.legalLinks = legal;

  const social = Object.entries(s.social ?? {})
    .filter(([, v]) => v)
    .map(([label, href]) => ({ label, href: String(href) }));
  if (social.length) merged.social = social;

  return merged;
}
