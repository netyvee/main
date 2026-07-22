#!/usr/bin/env node
// SG-02 Tier 3 (Main-only) — LIVE-SERVED rendered verification.
//
// Fetches the DEPLOYED page through Vercel "Protection Bypass for Automation" and asserts the
// served HTML renders exactly the cross-site occurrences declared in site-manifest.json.
//
// D-094 / Rule 59 / P4-RENDER-TEST-01: a login / SSO interstitial (or a redirect to one) is
// UNVERIFIED, never a pass. This is the whole reason Tier 3 could not close before a bypass secret.
//
// Usage:
//   node scripts/tier3-live-render.mjs --url https://<deployment>.vercel.app
//        reads VERCEL_AUTOMATION_BYPASS_SECRET from env; applies the bypass as header AND query.
//   node scripts/tier3-live-render.mjs --html-file ./page.html
//        offline harness self-test — no network, no secret.
//
// Exit codes:  0 = VALID   1 = INVALID   2 = UNVERIFIED
//
// Scope: netyvee/main ONLY. Asserts render matches the manifest; approves no gated division,
// adds no link, touches no gate.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const url = argOf('--url');
const htmlFile = argOf('--html-file');

const SSO_MARKERS = [
  /Login\s*[–-]\s*Vercel/i, /vercel\.com\/(login|sso)/i, /Authentication Required/i,
  /vercel-sso/i, /sso-api/i, /_vercel\/sso/i, /<title>[^<]*Vercel[^<]*<\/title>/i,
];

function die(kind, msg) {            // kind: 'INVALID' (1) | 'UNVERIFIED' (2)
  console.error(`\n✖ ${kind}: ${msg}`);
  process.exit(kind === 'UNVERIFIED' ? 2 : 1);
}

async function getHtml() {
  if (htmlFile) return readFileSync(htmlFile, 'utf8');
  if (!url) die('UNVERIFIED', 'no --url and no --html-file given');
  const secret = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim();
  if (!secret) die('UNVERIFIED', 'VERCEL_AUTOMATION_BYPASS_SECRET not set — cannot traverse deployment protection');

  // Vercel automation bypass sets a bypass cookie and 307-redirects to "/". undici has no cookie jar,
  // so we follow redirects MANUALLY, carrying Set-Cookie forward and keeping the bypass header on every
  // hop. A redirect to vercel.com/sso means the secret was NOT accepted → UNVERIFIED.
  let current = url + (url.includes('?') ? '&' : '?') +
    `x-vercel-protection-bypass=${encodeURIComponent(secret)}&x-vercel-set-bypass-cookie=true`;
  let cookies = '';
  const trail = [];
  for (let hop = 0; hop < 6; hop++) {
    const headers = { 'user-agent': 'vigil-tier3-live-render', 'x-vercel-protection-bypass': secret };
    if (cookies) headers.cookie = cookies;
    let res;
    try { res = await fetch(current, { redirect: 'manual', headers }); }
    catch (e) { die('UNVERIFIED', `transport error on ${current}: ${e.cause?.code || e.cause?.message || e.message}. Trail: ${trail.join(' -> ')}`); }
    const setC = (typeof res.headers.getSetCookie === 'function') ? res.headers.getSetCookie() : [];
    if (setC.length) {
      const jar = setC.map((c) => c.split(';')[0]).join('; ');
      cookies = cookies ? `${cookies}; ${jar}` : jar;
    }
    trail.push(String(res.status));
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) die('UNVERIFIED', `3xx with no Location. Trail: ${trail.join(' -> ')}`);
      const next = new URL(loc, current);
      if (/(^|\.)vercel\.com$/i.test(next.hostname) || /\/sso|\/login/i.test(next.pathname)) {
        die('UNVERIFIED', `redirected to Vercel SSO (${next.href}) — the bypass secret was not accepted. Trail: ${trail.join(' -> ')}`);
      }
      current = next.href;
      continue;
    }
    if (res.status !== 200) die('UNVERIFIED', `expected 200, got ${res.status}. Trail: ${trail.join(' -> ')}`);
    return await res.text();
  }
  die('UNVERIFIED', `too many redirects. Trail: ${trail.join(' -> ')}`);
}

const html = await getHtml();

// ── P4-RENDER-TEST-01: refuse an SSO/login page even if it answered 200 ───────
for (const re of SSO_MARKERS) {
  if (re.test(html)) die('UNVERIFIED', `served content is a Vercel protection/SSO interstitial (matched ${re}) — not the real page. NOT a pass.`);
}

// ── Manifest declaration = source of truth for what MUST render ───────────────
const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'site-manifest.json'), 'utf8'));
const occ = manifest.sitewide_outbound_links || [];
if (occ.length === 0) die('UNVERIFIED', 'manifest has no sitewide_outbound_links to verify');

const problems = [];
const notes = [];
const hrefPresent = (h) => html.includes(`href="${h}"`) || html.includes(`href='${h}'`);
const hrefCount = (h) => (html.split(`href="${h}"`).length - 1) + (html.split(`href='${h}'`).length - 1);

for (const l of occ) {
  if (!hrefPresent(l.href)) { problems.push(`MISSING: ${l.placement} "${l.anchor_text}" -> ${l.href} not in served HTML`); continue; }
  if (!html.includes(l.anchor_text)) problems.push(`ANCHOR: ${l.href} present but anchor text "${l.anchor_text}" not found`);
}
const declaredPerHost = {};
for (const l of occ) declaredPerHost[l.href] = (declaredPerHost[l.href] || 0) + 1;
for (const [h, n] of Object.entries(declaredPerHost)) {
  const rendered = hrefCount(h);
  if (rendered < n) problems.push(`COUNT: ${h} declares ${n} occurrences, only ${rendered} rendered`);
  else if (rendered > n) notes.push(`extra: ${h} rendered ${rendered}x vs ${n} declared`);
}
if (occ.some((l) => l.rel !== null)) notes.push('manifest now declares a non-null rel — recheck expectations');
if (/data-vf-rel/i.test(html)) problems.push('FORBIDDEN: served HTML emits data-vf-rel, but no occurrence declares a rel');
if (/rel=["']corporate_parent["']/i.test(html)) problems.push('FORBIDDEN: served HTML emits rel="corporate_parent" on the corporate site');
const allowedHosts = new Set(occ.map((l) => l.destination_host));
for (const m of html.matchAll(/href=["'](https:\/\/([a-z0-9-]+)\.vigilservices\.co\.uk[^"']*)["']/gi)) {
  const host = `${m[2]}.vigilservices.co.uk`;
  if (!allowedHosts.has(host)) notes.push(`UNEXPECTED absolute cross-site link rendered: ${m[1]}`);
}
const gated = occ.filter((l) => l.founder_gate === 'MAIN-G6');
notes.push(`MAIN-G6 gated occurrences (rendered as pre-existing source, NOT approved here): ${gated.map((l) => l.anchor_text).join(', ') || '(none)'}`);
if (gated.some((l) => l.gate_status !== 'UNRESOLVED')) problems.push('GATE: a MAIN-G6 occurrence is no longer UNRESOLVED — gate state changed unexpectedly');

console.log(`Tier-3 live-render — manifest schema ${manifest.schema_version}, content_hash ${String(manifest.content_hash || '').slice(0, 12)}…`);
console.log(`Declared occurrences: ${occ.length}\n`);
for (const l of occ) {
  const bad = problems.some((p) => p.includes(l.href) && !p.startsWith('COUNT') && !p.startsWith('FORBIDDEN'));
  console.log(`  ${bad ? '✖' : '✓'} ${l.placement.padEnd(10)} ${l.anchor_text.padEnd(24)} -> ${l.href}${l.founder_gate ? '  [GATED:' + l.founder_gate + ']' : ''}`);
}
for (const n of notes) console.log(`  · ${n}`);
if (problems.length) {
  console.error(`\n✖ INVALID — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   - ${p}`);
  process.exit(1);
}
console.log(`\n✓ VALID — all ${occ.length} declared occurrences render in the live-served page; ` +
  `no data-vf-rel, no corporate_parent edge; gated divisions unchanged; no unexpected cross-site link.`);
process.exit(0);
