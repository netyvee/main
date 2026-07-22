import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { CookieConsent } from '@vigil/web-framework';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400', '500'], display: 'swap', variable: '--font-dm-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['500'], style: ['normal', 'italic'], display: 'swap', variable: '--font-playfair' });

export const metadata: Metadata = {
  metadataBase: new URL('https://vigilservices.co.uk'),
  title: { default: 'Vigil Services Ltd', template: '%s' },
  description: 'Vigil Services Ltd — the parent company of Vigil Cleaning Services, Vigil Security Services, Vigil Care Services and Vigil Care Staffing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${dmSans.variable} ${playfair.variable}`}>
      {/* vf-typography = opt-in shared type scale (framework tokens.css).
          MAIN-HOMEPAGE-VISUAL-02 (founder-approved reference): the corporate front door is a
          LIGHT page (white ground, navy text) — navy appears only in the hero band + footer.
          This overrides the earlier all-navy estate default for main (a founder visual decision);
          the division sites keep the dark palette. */}
      <body className="vf-typography" style={{ background: '#ffffff', color: '#0a1628' }}>
        {children}
        {/* MAIN-COOKIE-CONSENT-01 / MAIN-ANALYTICS-01 (D-103): GA4 G-KTH8TMCHTT loads ONLY after Accept. */}
        <CookieConsent measurementId="G-KTH8TMCHTT" cookiePolicyHref="/cookies" />
      </body>
    </html>
  );
}
