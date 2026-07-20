import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
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
          Shared navy/teal palette — main is the brand front door, so it carries the
          estate palette rather than a distinct corporate one (DESIGN-SYSTEM.md). */}
      <body className="vf-typography" style={{ background: '#0a1628', color: '#ffffff' }}>{children}</body>
    </html>
  );
}
