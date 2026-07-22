#!/usr/bin/env node
/**
 * SM-01 — deterministic site manifest for netyvee/main.
 *
 * WHY THIS EXISTS
 *
 * SG-02 validates links the CRM knows about. It reads registered relationships from
 * the CRM database and never opens a repository, so the absolute URLs hard-coded in
 * `config/site.ts` are invisible to it: they are rendered on every page and validated
 * by nothing. This script makes them DISCOVERABLE.
 *
 * WHAT A MANIFEST IS, AND IS NOT
 *
 *   IS      a repository DECLARATION — "these are the routes I expect to serve and
 *           the absolute links I intend to render, from this commit".
 *   IS NOT  proof of anything. It is not network verification (SG-02 Tier 2) and it is
 *           certainly not rendered verification (Tier 3, unbuilt). A declaration that
 *           called itself verified would be FALSE-SUCCESS-DEPLOY-01 with extra steps.
 *
 * Nothing here changes a rendered link, an anchor, the navigation, the footer, a
 * canonical tag or any page content. It only reads.
 *
 * USAGE
 *   node scripts/generate-manifest.mjs            # write site-manifest.json
 *   node scripts/generate-manifest.mjs --check    # fail if the committed manifest is stale
 *   node scripts/generate-manifest.mjs --stdout   # print, write nothing
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'site-manifest.json');
const SCHEMA_VERSION = 1;

/* ─────────────────────────────────────────────────────────────────────────────
 * HOST CLASSIFICATION — a bounded, acknowledged duplicate.
 *
 * The AUTHORITY for site identity is the CRM's config/sites.php via SiteRegistry.
 * This repository cannot read it, so the table below restates the minimum needed to
 * classify a host at build time. That duplication is deliberate and bounded, and it
 * is why the manifest records a CLAIMED classification: SM-02 ingestion must
 * re-validate every claim against SiteRegistry rather than trusting this file. If the
 * two ever disagree, the CRM wins and the manifest is wrong by definition.
 * ────────────────────────────────────────────────────────────────────────────── */
const CORPORATE_HOST = 'vigilservices.co.uk';
const DIVISION_HOSTS = {
  'cleaning.vigilservices.co.uk': 'cleaning',
  'security.vigilservices.co.uk': 'security',
  'care.vigilservices.co.uk': 'care',
  'staffing.vigilservices.co.uk': 'staffing',
};
const APPROVED_EXTERNAL = new Set(['app.vigilservices.co.uk', 'res.cloudinary.com']);

/** MAIN-G6 (division public-listing gate) — RESOLVED 2026-07-22 (D-101): the founder approved public
 *  listing of ALL FOUR divisions on the corporate homepage (Cleaning, Security, Care Services, Care
 *  Staffing). No division is deferred any longer. Kept as an (empty) set so re-gating is a one-line
 *  change if the founder ever reverses. D-101 approves the LISTING/gateway link only — not a full
 *  Care/Staffing corporate overview page. */
const DEFERRED_DIVISIONS = new Set([]);

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function classify(url) {
  const host = hostOf(url);
  if (!host) return { destination_host: '', destination_classification: 'malformed' };
  if (host === CORPORATE_HOST) return { destination_host: host, destination_classification: 'corporate' };
  if (DIVISION_HOSTS[host]) {
    return { destination_host: host, destination_classification: 'division', division: DIVISION_HOSTS[host] };
  }
  if (APPROVED_EXTERNAL.has(host)) return { destination_host: host, destination_classification: 'approved_external' };
  return { destination_host: host, destination_classification: 'unclassified' };
}

/**
 * Relationship, per D-095 vocabulary. THIS SITE IS THE CORPORATE APEX, so a link to a
 * division is `corporate_to_division` — which D-033 clause 4 authorises and which is
 * the entire purpose of this site. It is NOT `division_to_division`, and this function
 * can never emit that: there is no source division here to be one end of it.
 */
function relationshipFor(cls) {
  switch (cls.destination_classification) {
    case 'division':          return 'corporate_to_division';
    case 'approved_external': return 'operational_destination';
    case 'corporate':         return 'self';
    default:                  return null; // unclassified → no relationship → build failure
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * DISCOVERY
 * ────────────────────────────────────────────────────────────────────────────── */

const ABS = /https?:\/\/[^\s"'`<>)]+/g;

/** Strip a trailing punctuation character a regex may have swallowed. */
const clean = (u) => u.replace(/[.,;:)]+$/, '');

/**
 * Navigation and footer links.
 *
 * TWO SOURCES, and the second is the one that would be missed. `config/site.ts` holds
 * the static defaults, but `config/loadSiteNav.ts` merges `content/site-settings.json`
 * OVER them when the CRM has published one — so at build time the rendered nav can
 * differ from the file a reader would check. Both are read here, and `origin` records
 * which one actually wins, because a manifest that silently reported only the static
 * defaults would be confidently wrong on exactly the sites where the CRM is in charge.
 */
function discoverNavAndFooter() {
  const out = [];
  const overridePath = path.join(ROOT, 'content', 'site-settings.json');
  const override = fs.existsSync(overridePath)
    ? JSON.parse(fs.readFileSync(overridePath, 'utf8'))
    : null;

  const src = fs.readFileSync(path.join(ROOT, 'config', 'site.ts'), 'utf8');
  const lines = src.split('\n');

  // Static defaults: pair each absolute href with the label on the same line.
  let inFooter = false;
  lines.forEach((line, i) => {
    if (/^\s*footer\s*:/.test(line)) inFooter = true;
    const m = line.match(/href:\s*'([^']+)'/);
    if (!m) return;
    const href = m[1];
    if (!/^https?:\/\//.test(href)) return; // relative links are out of scope for SM-01
    const label = (line.match(/label:\s*'([^']+)'/) || [, ''])[1];
    out.push({
      href,
      anchor_text: label,
      placement: inFooter ? 'footer' : 'header_nav',
      scope: 'sitewide',
      source_file: 'config/site.ts',
      source_line: i + 1,
      origin: override ? 'static_default_overridden' : 'hard_coded',
      rel: null,
    });
  });

  // CRM override, when present — these are what actually render.
  if (override) {
    for (const item of override.nav ?? []) {
      if (!/^https?:\/\//.test(item.href ?? '')) continue;
      out.push({
        href: item.href, anchor_text: item.label ?? '', placement: 'header_nav', scope: 'sitewide',
        source_file: 'content/site-settings.json', source_line: null, origin: 'crm_published',
        rel: item.rel ?? null,
      });
    }
    for (const col of override.footer?.columns ?? []) {
      for (const l of col.links ?? []) {
        if (!/^https?:\/\//.test(l.href ?? '')) continue;
        out.push({
          href: l.href, anchor_text: l.label ?? '', placement: 'footer', scope: 'sitewide',
          source_file: 'content/site-settings.json', source_line: null, origin: 'crm_published',
          rel: l.rel ?? null,
        });
      }
    }
  }

  return out;
}

/** Absolute links inside published page JSON. None today; the reader exists so a future one is not missed. */
function discoverContentLinks() {
  const dir = path.join(ROOT, 'content', 'pages');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const KEYS = new Set(['href', 'cta_url', 'url', 'view_all_url', 'cta_secondary_url']);

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === 'string' && KEYS.has(k) && /^https?:\/\//.test(v)) {
            out.push({
              href: v, anchor_text: node.cta_label ?? '', placement: 'page_content',
              scope: 'page_specific', source_file: `content/pages/${file}`, source_line: null,
              origin: 'crm_published', rel: null, route: '/' + json.slug,
            });
          } else walk(v);
        }
      }
    };
    walk(json.sections ?? []);
  }

  return out;
}

/**
 * Absolute URLs in app source (metadata, structured data, sitemap, robots).
 *
 * These are almost all SELF-REFERENTIAL — the site declaring its own origin — not
 * outbound links. They are recorded separately as `site_origin_declarations` so a
 * reader is never invited to treat `metadataBase` as a link to somewhere else.
 * DYNAMIC construction is reported explicitly rather than resolved: a template
 * literal or a concatenation cannot be statically resolved, and guessing is the
 * failure mode this whole programme exists to remove.
 */
function discoverAppSources() {
  const declarations = [];
  const unresolved = [];
  const files = ['app/layout.tsx', 'app/sitemap.ts', 'app/robots.ts', 'app/[[...slug]]/page.tsx'];

  for (const rel of files) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');

    src.split('\n').forEach((line, i) => {
      // A dynamic absolute URL: `${...}` inside an http(s) string.
      if (/`https?:\/\/[^`]*\$\{/.test(line)) {
        unresolved.push({
          source_file: rel, source_line: i + 1, reason: 'template_literal_interpolation',
          excerpt: line.trim().slice(0, 120),
        });
        return;
      }
      // Ignore comment lines: robots.ts documents the live WordPress defect (M-8) by
      // quoting the offending URL. Recording a commented URL as a declared link would
      // be a false positive, and a manifest with false positives gets ignored.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;

      for (const raw of line.match(ABS) ?? []) {
        const href = clean(raw);
        declarations.push({ href, source_file: rel, source_line: i + 1, ...classify(href) });
      }
    });
  }

  return { declarations, unresolved };
}

/** Routes the repository expects to serve, from the catch-all's content. */
function discoverRoutes(contentLinks) {
  const dir = path.join(ROOT, 'content', 'pages');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((file) => {
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const route = '/' + json.slug;
    return {
      route,
      canonical_url: `https://${CORPORATE_HOST}${json.seo?.canonical ?? route}`,
      indexability_expectation: json.seo?.noindex ? 'noindex' : 'indexable',
      publication_status: json.status ?? 'unknown',
      content_source: `content/pages/${file}`,
      outbound_links: contentLinks.filter((l) => l.route === route).map(({ route: _r, ...rest }) => rest),
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BUILD
 * ────────────────────────────────────────────────────────────────────────────── */

function commitSha() {
  // GITHUB_SHA in CI; git locally. Never invented — an unknown provenance is stated.
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    // stderr suppressed: outside a git checkout this fails noisily and the fallback is
    // already correct. Noise on a passing run is how a gate stops being read.
    return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'unknown';
  }
}

function frameworkPin() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.dependencies?.['@vigil/web-framework'] ?? null;
}

function build() {
  const sitewide = [...discoverNavAndFooter()];
  // Classify page-content links too (v0.6.6 / MAIN-HOMEPAGE-VISUAL-02): the division links moved from
  // the header nav into the on-page image gateway (division_image_gateway), so page_content is now the
  // PRIMARY division-link surface. Classifying + validating them here (not just sitewide) keeps every
  // division link — wherever it renders — under the same D-033/D-095 governance.
  const contentLinks = discoverContentLinks().map((l) => {
    const cls = classify(l.href);
    return { ...l, ...cls, relationship_type: relationshipFor(cls) };
  });
  const { declarations, unresolved } = discoverAppSources();
  const routes = discoverRoutes(contentLinks);

  const outbound = sitewide.map((l) => {
    const cls = classify(l.href);
    const relationship = relationshipFor(cls);
    const entry = { ...l, ...cls, relationship_type: relationship };
    // MAIN-G6: listing the DEFERRED divisions publicly is an open founder gate. The
    // link is inventoried, never declared approved — recording it as approved would
    // resolve a gate this package has no authority over.
    if (cls.division && DEFERRED_DIVISIONS.has(cls.division)) {
      entry.founder_gate = 'MAIN-G6';
      entry.gate_status = 'UNRESOLVED';
    }
    return entry;
  });

  // Deduplicate for reporting, but keep every occurrence: the same destination in the
  // header and the footer is TWO renderable links, and collapsing them would hide a
  // duplicate that a policy cap needs to see.
  const byHref = {};
  for (const l of outbound) byHref[l.href] = (byHref[l.href] ?? 0) + 1;
  for (const l of outbound) l.duplicate_occurrences = byHref[l.href];

  const body = {
    schema_version: SCHEMA_VERSION,
    site: 'main',
    domain: `https://${CORPORATE_HOST}`,
    repository: 'netyvee/main',
    framework_pin: frameworkPin(),
    // A DECLARATION, not proof — restated in the artefact so a consumer reading only
    // the JSON cannot mistake its status.
    declaration_only: true,
    verification_note:
      'This manifest declares intent from a commit. It is NOT network verification ' +
      '(SG-02 Tier 2) and NOT rendered verification (SG-02 Tier 3). A consumer must ' +
      're-validate every claimed classification against the CRM SiteRegistry.',
    routes,
    sitewide_outbound_links: outbound,
    site_origin_declarations: declarations,
    unresolved_dynamic_links: unresolved,
  };

  // Content hash EXCLUDES provenance, so regenerating at a different time or commit
  // produces the same hash for the same content — which is what makes drift
  // detection meaningful rather than a timestamp comparison.
  const content_hash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

  return {
    ...body,
    // MAIN-PROVENANCE-01: `commit_sha` is GENERATION-BASE provenance only. A manifest generated locally
    // and committed ALONGSIDE its content records HEAD-before-commit, so it lags the commit it actually
    // ships in. It must NOT be treated as the deployed-commit authority. The authoritative deployed-commit
    // binding is emitted at deploy time by qa.yml's "Deployment provenance evidence" step (content_hash +
    // github.sha + Vercel deployment id) and stored durably by the app-side Deployment record. `content_hash`
    // (below) is the stable content identity and is what manifest:check compares — never commit_sha.
    commit_sha: commitSha(),
    generated_at: new Date().toISOString(),
    content_hash,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * VALIDATE — no silent omissions
 * ────────────────────────────────────────────────────────────────────────────── */

function validate(manifest) {
  const errors = [];

  // Every absolute link — sitewide chrome AND page content (the image gateway) — is held to the same
  // rules. Page_content is validated too so a bad host in a gateway card fails the gate exactly as a
  // bad footer host would (the image gateway is the primary division surface since v0.6.6).
  const pageLinks = (manifest.routes ?? []).flatMap((r) => (r.outbound_links ?? []).map((l) => ({ ...l, route: r.route })));
  const all = [...manifest.sitewide_outbound_links, ...pageLinks];

  for (const l of all) {
    const where = `${l.source_file}${l.source_line ? ':' + l.source_line : l.route ? ' (' + l.route + ')' : ''}`;
    if (l.destination_classification === 'unclassified') {
      errors.push(`UNCLASSIFIED destination ${l.destination_host} (${where}). ` +
        'Every absolute link must resolve to a known host.');
    }
    if (l.destination_classification === 'malformed') {
      errors.push(`MALFORMED URL "${l.href}" (${where}).`);
    }
    if (!l.relationship_type) {
      errors.push(`MISSING relationship for ${l.href} (${where}).`);
    }
    // Cannot occur from this repository — main is the corporate apex, not a division —
    // but asserted so a future refactor that changed that assumption fails loudly.
    if (l.relationship_type === 'division_to_division') {
      errors.push(`PROHIBITED division_to_division relationship for ${l.href} (D-095 / founder G-B).`);
    }
  }

  return errors;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * MAIN
 * ────────────────────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const manifest = build();
const errors = validate(manifest);

if (errors.length) {
  console.error(`\n✖ site-manifest: FAILED — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error('');
  process.exit(1);
}

if (args.includes('--stdout')) {
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

if (args.includes('--check')) {
  if (!fs.existsSync(OUT)) {
    console.error('\n✖ site-manifest.json is missing. Run: npm run manifest\n');
    process.exit(1);
  }
  const committed = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  // Compare CONTENT, not provenance. A manifest regenerated a second later has a
  // different generated_at and would otherwise always look stale.
  if (committed.content_hash !== manifest.content_hash) {
    console.error('\n✖ site-manifest.json is STALE — the repository declares links the manifest does not.');
    console.error(`    committed content_hash: ${committed.content_hash}`);
    console.error(`    regenerated:            ${manifest.content_hash}`);
    console.error('  Run: npm run manifest — and commit the result.\n');
    process.exit(1);
  }
  console.log(`✓ site-manifest: fresh (${manifest.sitewide_outbound_links.length} sitewide links, ` +
    `${manifest.routes.length} route(s), ${manifest.unresolved_dynamic_links.length} unresolved).`);
  process.exit(0);
}

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ site-manifest.json written — ${manifest.sitewide_outbound_links.length} sitewide links, ` +
  `${manifest.routes.length} route(s), ${manifest.unresolved_dynamic_links.length} unresolved dynamic.`);
