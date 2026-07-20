import type { MetadataRoute } from 'next';
import { getPage, getPageSlugs } from '@vigil/web-framework';

const BASE = 'https://vigilservices.co.uk';

// The framework ships no sitemap builder, so each consumer hand-rolls this — same
// shape as care/staffing. `seo.noindex` pages are excluded, which is what keeps the
// render pilot out of the sitemap automatically.
export default function sitemap(): MetadataRoute.Sitemap {
  return getPageSlugs()
    .map((f) => getPage(f))
    .filter((p): p is NonNullable<typeof p> => !!p && !p.seo.noindex)
    .map((p) => ({
      url: `${BASE}${(p.seo.canonical.replace(/\/$/, '') || '/')}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: p.page_type === 'homepage' ? 1 : 0.7,
    }));
}
