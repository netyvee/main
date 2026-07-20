#!/usr/bin/env node
// SM-F2 — END-TO-END ROUND-TRIP PROOF for typed link metadata.
//
// WHY THIS IS A BUILD AND NOT A UNIT TEST
// The defect it guards spanned three repositories and was invisible at every
// intermediate step: the framework type had no `rel`, this repo's loader stripped it,
// and the Shell never rendered it. A unit test at any one of those layers passes while
// the rendered page carries nothing — and hand-built fixtures agreeing with themselves
// is exactly how SM-02-F1 produced 34 green tests against an artefact that would have
// been rejected in reality. So this asserts against REAL BUILD OUTPUT: the actual
// loader, the actual installed framework, the actual Next renderer.
//
// WHAT IT DOES
//   1. writes a temporary content/site-settings.json declaring one rel'd link and one
//      un-rel'd link, plus one link carrying a HOSTILE rel value;
//   2. runs `next build`;
//   3. greps the emitted HTML for the rendered anchor;
//   4. restores the previous settings file (or removes it) unconditionally.
//
// The temporary settings file is NEVER committed and NEVER left behind. The link it
// declares is a test destination, not a governed edge: this script publishes nothing
// and authorises nothing. It does not add the Cleaning footer link, and it does not
// resolve MAIN-G6.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SETTINGS = path.join(ROOT, 'content', 'site-settings.json');
const OUT = path.join(ROOT, '.next', 'server', 'app');

const PROBE = 'https://roundtrip-probe.invalid/';
const PLAIN = 'https://roundtrip-plain.invalid/';
const HOSTILE = 'https://roundtrip-hostile.invalid/';

const fixture = {
  nav: [
    { label: 'Roundtrip Rel', href: PROBE, rel: 'corporate_parent' },
    { label: 'Roundtrip Plain', href: PLAIN },
    // An unrecognised rel MUST be dropped, not carried. If the loader ever copies
    // `rel` across instead of allow-listing it, this is the assertion that fails.
    { label: 'Roundtrip Hostile', href: HOSTILE, rel: 'nofollow ugc' },
  ],
};

let restore = null;
if (fs.existsSync(SETTINGS)) restore = fs.readFileSync(SETTINGS, 'utf8');

function cleanup() {
  if (restore === null) {
    if (fs.existsSync(SETTINGS)) fs.unlinkSync(SETTINGS);
  } else {
    fs.writeFileSync(SETTINGS, restore);
  }
}

const failures = [];
function check(ok, msg) {
  if (ok) console.log(`  ✓ ${msg}`);
  else { console.log(`  ✗ ${msg}`); failures.push(msg); }
}

try {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(fixture, null, 2));

  console.log('nav-rel-roundtrip: building with a rel-bearing site-settings.json…');
  execSync('npx next build', { stdio: 'inherit', cwd: ROOT });

  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) files.push(p);
    }
  })(OUT);

  if (files.length === 0) throw new Error('no rendered HTML found under .next/server/app');
  const html = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

  console.log(`\nnav-rel-roundtrip: asserting against ${files.length} rendered page(s)`);

  const relAnchors = html.match(new RegExp(`<a\\b[^>]*href="${PROBE}"[^>]*>`, 'gi')) ?? [];
  check(relAnchors.length > 0, 'the declared link reaches the rendered HTML at all');
  check(
    relAnchors.length > 0 && relAnchors.every((a) => a.includes('data-vf-rel="corporate_parent"')),
    'EVERY rendered occurrence carries data-vf-rel="corporate_parent"'
  );
  check(
    relAnchors.every((a) => !/\srel="/.test(a)),
    'no bare rel= attribute is emitted (corporate_parent is not an HTML link relation)'
  );

  const plainAnchors = html.match(new RegExp(`<a\\b[^>]*href="${PLAIN}"[^>]*>`, 'gi')) ?? [];
  check(plainAnchors.length > 0, 'an undeclared link still renders');
  check(plainAnchors.every((a) => !a.includes('data-vf-rel')), 'an undeclared link carries NO metadata');

  const hostileAnchors = html.match(new RegExp(`<a\\b[^>]*href="${HOSTILE}"[^>]*>`, 'gi')) ?? [];
  check(hostileAnchors.length > 0, 'a link with an unrecognised rel still renders as an ordinary link');
  check(
    hostileAnchors.every((a) => !a.includes('data-vf-rel') && !/\srel="/.test(a)),
    'an unrecognised rel is DROPPED, never carried through the allow-list'
  );
} finally {
  cleanup();
  console.log('\nnav-rel-roundtrip: site-settings.json restored');
}

if (failures.length) {
  console.error(`\nnav-rel-roundtrip: FAILED — ${failures.length} assertion(s)`);
  process.exit(1);
}
console.log('\nnav-rel-roundtrip: PASS — config → loader → framework → Shell → rendered anchor');
