import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getPage,
  getPageSlugs,
  paramsToFile,
  buildPageMetadata,
  RenderSections,
  Shell,
  JsonLd,
} from '@vigil/web-framework';
import { loadSiteNav } from '@/config/loadSiteNav';

export const dynamicParams = false; // only committed pages exist; everything else 404s

export function generateStaticParams() {
  return getPageSlugs().map((f) => ({ slug: f === 'index' ? [] : f.split('__') }));
}

export function generateMetadata({ params }: { params: { slug?: string[] } }): Metadata {
  // No ogImage default yet — the corporate OG asset is a brand decision. buildPageMetadata
  // falls back to its own deterministic default, and page JSON can override per page.
  return buildPageMetadata(getPage(paramsToFile(params.slug ?? [])));
}

export default function Page({ params }: { params: { slug?: string[] } }) {
  const page = getPage(paramsToFile(params.slug ?? []));
  if (!page) notFound();
  // Byte-identical to the care/staffing route by design: this is the SAME proven
  // render-from-JSON engine, not a corporate variant of it. Everything that differs
  // about the corporate site lives in data (content/pages/*.json + config/site.ts),
  // never in the renderer.
  const nav = loadSiteNav();
  return (
    <>
      <JsonLd page={page} origin="https://vigilservices.co.uk" />
      <Shell page={page} nav={nav}>
        <RenderSections page={page} />
      </Shell>
    </>
  );
}
