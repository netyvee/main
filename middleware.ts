import { NextResponse, type NextRequest } from 'next/server';

// MAIN-CUTOVER-EXECUTE-01 (D-102) — legacy WordPress URL handling, single-hop (no redirect chains).
// All legacy WP URLs carry a trailing slash; Next's own trailing-slash redirect is DISABLED
// (skipTrailingSlashRedirect in next.config) so these rules fire first and each is exactly one hop:
//   • retired pages -> 410 Gone (contact forms retired; reference flow is tokenised/private, no public
//     equivalent — never a redirect to the homepage or a candidate journey)
//   • legacy About -> 301 to the homepage (no standalone About page; the homepage is the gateway)
//   • every other trailing-slash path -> 308 to the canonical no-trailing-slash form (M-11 normalisation)
// Inert until vigilservices.co.uk points at this deployment (these paths do not exist here otherwise).
const GONE = new Set([
  '/contact-vigil-services-ltd-2-2',
  '/character-reference',
  '/employment-reference',
  '/locations.kml',
]);
const REDIRECT_HOME = new Set(['/about', '/about-vigil-services-ltd']);

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const raw = url.pathname;
  const path = raw !== '/' ? raw.replace(/\/+$/, '') : '/'; // canonical form, no trailing slash

  if (GONE.has(path)) {
    return new NextResponse('410 Gone — this page has been permanently removed.', {
      status: 410,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  if (REDIRECT_HOME.has(path)) {
    return NextResponse.redirect(new URL('/', url), 301);
  }
  // Trailing-slash normalisation (replaces Next's disabled automatic one) — single hop.
  if (raw !== '/' && raw.endsWith('/')) {
    return NextResponse.redirect(new URL(path + url.search, url), 308);
  }
  return NextResponse.next();
}

// Run on content paths only; skip Next internals. `/locations.kml` is matched explicitly (it has a dot).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
