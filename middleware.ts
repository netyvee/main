import { NextResponse, type NextRequest } from 'next/server';

// MAIN-CUTOVER-EXECUTE-01 (D-102) — retired legacy WordPress URLs return 410 Gone at cutover.
// These pages have no equivalent on the new corporate gateway: the general contact forms are retired
// (email-only contact), and the reference workflow is tokenised/private (no public start page), so the
// evidenced disposition is 410 — never a redirect to the homepage or an unrelated candidate journey.
// Inert until vigilservices.co.uk points at this deployment (the paths do not exist here anyway).
const GONE = new Set([
  '/contact-vigil-services-ltd-2-2',
  '/character-reference',
  '/employment-reference',
  '/locations.kml',
]);

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, '') || '/';
  if (GONE.has(path)) {
    return new NextResponse('410 Gone — this page has been permanently removed.', {
      status: 410,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/contact-vigil-services-ltd-2-2/:path*',
    '/character-reference/:path*',
    '/employment-reference/:path*',
    '/locations.kml',
  ],
};
