#!/usr/bin/env node
/**
 * SM-01 tests — dependency-free, offline, deterministic.
 *
 * WHY NOT VITEST. This repository has no test framework and its established idiom is a
 * plain node script that exits non-zero (`content-check.mjs`). Adding a runner would
 * mean a new devDependency and a lockfile change — and a lockfile change in THIS repo
 * is exactly what broke every Vercel deployment three packages ago. The cost is not
 * worth a nicer assertion syntax.
 *
 * NO NETWORK. Nothing here resolves a name or opens a socket. Discovery is static by
 * definition, and a test that needed the internet would be testing the internet.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const GEN = path.join(ROOT, 'scripts', 'generate-manifest.mjs');

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push({ name, message: e.message });
    console.log(`  ✗ ${name}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/** Run the generator against a directory and return the parsed manifest. */
function generate(cwd = ROOT) {
  const out = execFileSync(process.execPath, [GEN, '--stdout'], { cwd, encoding: 'utf8' });
  return JSON.parse(out);
}

/** Run the generator expecting a NON-ZERO exit; return stderr. */
function generateExpectingFailure(cwd) {
  try {
    execFileSync(process.execPath, [GEN, '--stdout'], { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    return String(e.stderr ?? '');
  }
  throw new Error('expected the generator to FAIL, but it succeeded');
}

/**
 * A throwaway copy of the repo with one file replaced. Fixtures on disk would drift
 * from the real config; copying the real one and editing it means the negative tests
 * exercise the same parser as production.
 */
function withScratch(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm01-'));
  for (const rel of ['config', 'content', 'app', 'scripts', 'package.json']) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, rel), { recursive: true });
  }
  mutate(dir);
  try { return generate(dir); } finally { /* caller may re-run */ }
}

function withScratchExpectingFailure(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm01-'));
  for (const rel of ['config', 'content', 'app', 'scripts', 'package.json']) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, rel), { recursive: true });
  }
  mutate(dir);
  return generateExpectingFailure(dir);
}

console.log('\nSM-01 — site manifest\n');

const m = generate();

// v0.6.6 / MAIN-HOMEPAGE-VISUAL-02 — division links now render in TWO governed surfaces: the footer
// (sitewide) and the on-page image gateway (page_content, in routes). Governance is identical in both.
// These helpers gather across both so the tests assert the whole division-link set, not just the chrome.
const routeLinks = (m.routes ?? []).flatMap((r) => (r.outbound_links ?? []).map((l) => ({ ...l, route: r.route })));
const allLinks = [...m.sitewide_outbound_links, ...routeLinks];
const allDivisionLinks = allLinks.filter((l) => l.destination_classification === 'division');

// 1 + 2. Discovery of the known links.
check('discovers the four sitewide (footer) absolute links + four gateway links = eight division links', () => {
  // The header nav no longer carries division links (they are on-page anchors now); the four division
  // destinations render in the footer (sitewide) and the image gateway (page_content). Both are governed.
  assert(m.sitewide_outbound_links.length === 4,
    `expected 4 sitewide (footer) links, got ${m.sitewide_outbound_links.length}`);
  assert(allDivisionLinks.length === 8,
    `expected 8 division links across footer+gateway, got ${allDivisionLinks.length}`);
});

check('discovers the hard-coded anchors with their visible text', () => {
  const cleaning = m.sitewide_outbound_links.find(
    (l) => l.href.includes('cleaning.') && l.placement === 'footer');
  assert(cleaning, 'no cleaning footer link found');
  assert(cleaning.anchor_text === 'Vigil Cleaning Services',
    `anchor text not captured: ${cleaning.anchor_text}`);
  assert(cleaning.origin === 'hard_coded', `origin should be hard_coded, got ${cleaning.origin}`);
});

// 4. Config-derived (CRM-published) links are discovered where statically resolvable.
check('discovers a CRM-published override link and marks its origin', () => {
  const out = withScratch((dir) => {
    fs.writeFileSync(path.join(dir, 'content', 'site-settings.json'), JSON.stringify({
      nav: [{ label: 'Cleaning', href: 'https://cleaning.vigilservices.co.uk/', rel: null }],
    }));
  });
  const published = out.sitewide_outbound_links.filter((l) => l.origin === 'crm_published');
  assert(published.length === 1, `expected 1 crm_published link, got ${published.length}`);
  const statics = out.sitewide_outbound_links.filter((l) => l.origin === 'static_default_overridden');
  assert(statics.length === 4, 'the four static footer defaults must still be recorded, marked as overridden');
});

// 5 + 6. Placement and scope.
check('assigns sitewide placement to footer links', () => {
  const footer = m.sitewide_outbound_links.filter((l) => l.placement === 'footer');
  assert(footer.length === 4, `expected 4 footer links, got ${footer.length}`);
  assert(footer.every((l) => l.scope === 'sitewide'), 'footer links must be sitewide');
});

check('header nav carries no absolute division links (they moved to the on-page gateway)', () => {
  // The reference header uses on-page anchors (/#divisions, /#contact), not absolute division links, so
  // no division link appears in header_nav any more. The four divisions live in the gateway route instead.
  const nav = m.sitewide_outbound_links.filter((l) => l.placement === 'header_nav');
  assert(nav.length === 0, `expected 0 absolute nav links, got ${nav.length}`);
  const gateway = routeLinks.filter((l) => l.placement === 'page_content' && l.destination_classification === 'division');
  assert(gateway.length === 4, `expected 4 gateway division links, got ${gateway.length}`);
});

check('represents page-specific links per route', () => {
  assert(Array.isArray(m.routes), 'routes must be an array');
  assert(m.routes.every((r) => Array.isArray(r.outbound_links)),
    'every route must declare outbound_links, even when empty');
});

// 7 + 8 + 9. No silent omissions.
check('FAILS on an unknown destination host', () => {
  const err = withScratchExpectingFailure((dir) => {
    const p = path.join(dir, 'config', 'site.ts');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
      .replace("href: 'https://cleaning.vigilservices.co.uk/' }",
        "href: 'https://competitor.example/' }"));
  });
  assert(/UNCLASSIFIED/.test(err), `expected an UNCLASSIFIED failure, got: ${err.slice(0, 200)}`);
});

check('FAILS on an unknown host in the IMAGE GATEWAY (page content is governed too)', () => {
  const err = withScratchExpectingFailure((dir) => {
    const p = path.join(dir, 'content', 'pages', 'index.json');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
      .replace('https://care.vigilservices.co.uk/', 'https://competitor.example/'));
  });
  assert(/UNCLASSIFIED/.test(err), `expected an UNCLASSIFIED failure from a gateway link, got: ${err.slice(0, 200)}`);
});

check('FAILS on a malformed absolute URL', () => {
  const err = withScratchExpectingFailure((dir) => {
    const p = path.join(dir, 'config', 'site.ts');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
      .replace("href: 'https://cleaning.vigilservices.co.uk/' }", "href: 'https://' }"));
  });
  assert(/MALFORMED|UNCLASSIFIED/.test(err), `expected a failure, got: ${err.slice(0, 200)}`);
});

check('a missing relationship is a failure, never an omission', () => {
  assert(m.sitewide_outbound_links.every((l) => l.relationship_type),
    'every discovered link must carry a relationship_type');
});

check('cannot emit a division_to_division relationship from the corporate apex', () => {
  assert(m.sitewide_outbound_links.every((l) => l.relationship_type !== 'division_to_division'),
    'D-095 / founder G-B: division_to_division is prohibited');
});

// 10. Corporate → division is represented without weakening D-095.
check('represents corporate_to_division for every division link (footer + gateway)', () => {
  assert(allDivisionLinks.length === 8, `expected 8 division links, got ${allDivisionLinks.length}`);
  assert(allDivisionLinks.every((l) => l.relationship_type === 'corporate_to_division'),
    'division links must be corporate_to_division (D-033 clause 4) — wherever they render');
});

// 11. MAIN-G6 RESOLVED 2026-07-22 (D-101): all four divisions approved for public listing.
check('MAIN-G6 resolved (D-101) — no division link remains UNRESOLVED-gated', () => {
  const stillGated = allLinks.filter((l) => l.gate_status === 'UNRESOLVED');
  assert(stillGated.length === 0, `MAIN-G6 is resolved; expected 0 UNRESOLVED links, got ${stillGated.length}`);
  // All four divisions are listed corporate->division (8 occurrences: 4 footer + 4 gateway).
  const divisions = new Set(allDivisionLinks.map((l) => l.division));
  assert(['cleaning', 'security', 'care', 'staffing'].every((d) => divisions.has(d)),
    'all four divisions must be present as corporate->division links');
});

// 12. Duplicates.
check('records every renderable occurrence rather than collapsing them', () => {
  // Cleaning renders twice across the site — once in the footer (sitewide) and once in the gateway
  // (page_content) — so the manifest must show both occurrences, not one collapsed entry.
  const cleaning = allLinks.filter((l) => l.href.includes('cleaning.'));
  assert(cleaning.length === 2, 'cleaning renders in both the footer and the gateway = two renderable links');
  const placements = new Set(cleaning.map((l) => l.placement));
  assert(placements.has('footer') && placements.has('page_content'),
    `expected cleaning in footer + page_content, got ${[...placements].join(', ')}`);
});

// 13. Dynamic links are surfaced, not silently dropped.
check('surfaces an unresolved dynamic URL instead of guessing', () => {
  const out = withScratch((dir) => {
    const p = path.join(dir, 'app', 'sitemap.ts');
    const src = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, src + '\n// eslint-disable-next-line\nconst dynamic = `https://${host}/x`;\n');
  });
  assert(out.unresolved_dynamic_links.length === 1,
    `expected 1 unresolved dynamic link, got ${out.unresolved_dynamic_links.length}`);
  assert(out.unresolved_dynamic_links[0].reason === 'template_literal_interpolation',
    'the reason must be stated');
});

check('does not report a URL that only appears inside a comment', () => {
  // robots.ts quotes the live WordPress defect (rankmath.com, M-8) in a comment.
  const hosts = m.site_origin_declarations.map((d) => d.destination_host);
  assert(!hosts.includes('rankmath.com'),
    'a commented URL is documentation, not a declared link — reporting it is a false positive');
});

// 14 + 15. Provenance and determinism.
check('includes commit SHA, schema version and a content hash', () => {
  assert(m.schema_version === 1, 'schema_version must be present');
  assert(typeof m.commit_sha === 'string' && m.commit_sha.length > 0, 'commit_sha must be present');
  assert(/^[a-f0-9]{64}$/.test(m.content_hash), 'content_hash must be a sha256');
  assert(m.repository === 'netyvee/main', 'repository identity must be present');
});

check('is deterministic — the content hash is stable across runs', () => {
  const again = generate();
  assert(again.content_hash === m.content_hash,
    'content_hash must not depend on generation time');
  assert(again.generated_at !== undefined, 'generated_at is provenance and may differ');
});

check('declares itself a declaration, not proof', () => {
  assert(m.declaration_only === true, 'declaration_only must be true');
  assert(/NOT network verification/i.test(m.verification_note), 'the note must disclaim verification');
});

// 16. Offline.
check('requires no network access', () => {
  const src = fs.readFileSync(GEN, 'utf8');
  for (const banned of ['fetch(', 'node:http', 'node:https', 'dns.', 'node:dns']) {
    assert(!src.includes(banned), `the generator must not use ${banned}`);
  }
});

console.log(`\n${failures.length ? '✖' : '✓'} ${passed} passed, ${failures.length} failed\n`);
for (const f of failures) console.error(`  ✗ ${f.name}\n    ${f.message}`);
process.exit(failures.length ? 1 : 0);
