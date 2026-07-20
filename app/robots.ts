import type { MetadataRoute } from 'next';

// NOTE for cutover: the live WordPress robots.txt currently advertises
//   Sitemap: https://rankmath.com/sitemap_index.xml
// — the Rank Math PLUGIN VENDOR's sitemap, not this site's. That is a live defect
// (M-8) and is fixed here by construction rather than ported.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The render pilot is a technical checkpoint, not content. It is noindex in
        // its page JSON as well — belt and braces, because it must never be indexed.
        disallow: ['/api/', '/pilot-render-check/'],
      },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'Googlebot', allow: '/' },
    ],
    sitemap: 'https://vigilservices.co.uk/sitemap.xml',
    host: 'https://vigilservices.co.uk',
  };
}
