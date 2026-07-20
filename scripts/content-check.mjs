#!/usr/bin/env node
/**
 * Corporate main-site content gate.
 *
 * WHY THIS EXISTS INSTEAD OF THE FRAMEWORK'S division-isolation-check.mjs:
 * that script's DIVISIONS table has four keys — cleaning, security, care_services,
 * care_staffing — and no `main`, so `--own main` exits with "Unknown site key".
 * More importantly, running it here would encode the WRONG RULE. On a division site
 * the check asserts "no OTHER division's phone or domain appears". On the corporate
 * front door the rule INVERTS: linking to all four business domains is the entire
 * purpose of the site (D-033).
 *
 * So the corporate variant asserts the half that still applies, and only that half:
 *
 *   ALLOWED   — links to all four division domains (that is what this site is for)
 *   FORBIDDEN — presenting any single division's PHONE as the corporate number
 *
 * That second rule is not hypothetical. The live WordPress site displays
 * 020 3973 8887 as its contact number, which is the CARE STAFFING number. Migrating
 * that verbatim would put a division's phone on the group's own site and, worse,
 * would look correct to a division-scoped checker that never runs here.
 *
 * Registered as a framework gap (workstream B): division-isolation-check.mjs should
 * grow a `main` mode so this logic can move upstream instead of living per-consumer.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content', 'pages');
const ORIGIN = 'https://vigilservices.co.uk';

// Every division phone, in the three forms they appear in real markup.
const DIVISION_PHONES = {
  cleaning: '020 3098 6037',
  security: '020 3973 8892',
  care_services: '020 3973 8886',
  care_staffing: '020 3973 8887',
};
const phoneForms = (p) => {
  const compact = p.replace(/\s+/g, '');
  return [p, compact, compact.replace(/^0/, '+44')];
};

const errors = [];
const warnings = [];

if (!fs.existsSync(DIR)) {
  console.error(`FAIL: ${DIR} does not exist.`);
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error('FAIL: content/pages/ contains no page JSON. Nothing has been published from the CRM.');
  process.exit(1);
}

const titles = new Map();

for (const file of files) {
  const full = path.join(DIR, file);
  let page;
  try {
    page = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    errors.push(`${file}: not valid JSON — ${e.message}`);
    continue;
  }

  // Contract shape. schema_version is written by the CRM exporter and, until PUB-01
  // lands, is read by nothing — so assert it here rather than trusting it silently.
  if (page.schema_version !== 1) {
    errors.push(`${file}: schema_version is ${JSON.stringify(page.schema_version)}, expected 1`);
  }
  if (page.site !== 'main') {
    errors.push(`${file}: site is "${page.site}", expected "main" — content for another site must never land in this repo`);
  }
  for (const key of ['slug', 'page_type', 'seo', 'sections', 'nap']) {
    if (page[key] === undefined) errors.push(`${file}: missing required key "${key}"`);
  }
  if (!Array.isArray(page.sections) || page.sections.length === 0) {
    errors.push(`${file}: sections is empty — a page with no sections renders blank`);
  }

  // SEO essentials.
  const seo = page.seo ?? {};
  if (!seo.canonical) {
    errors.push(`${file}: seo.canonical is missing`);
  } else if (!seo.canonical.startsWith(ORIGIN)) {
    errors.push(`${file}: seo.canonical "${seo.canonical}" is not on ${ORIGIN}`);
  }
  if (!seo.title) errors.push(`${file}: seo.title is missing`);
  if (seo.title) {
    const seen = titles.get(seo.title);
    if (seen) errors.push(`${file}: duplicate seo.title, also used by ${seen}`);
    else titles.set(seo.title, file);
  }

  // The corporate NAP rule.
  const blob = JSON.stringify(page);
  for (const [division, phone] of Object.entries(DIVISION_PHONES)) {
    for (const form of phoneForms(phone)) {
      if (blob.includes(form)) {
        errors.push(
          `${file}: contains the ${division} phone (${form}). The corporate site must not present a ` +
          `single division's number as its own — see config/site.ts. If a corporate number has been ` +
          `agreed, it belongs in the CRM registry (config/sites.php main.phone), not in page content.`
        );
      }
    }
  }

  // nap.phone must stay empty until the corporate number decision lands.
  if (page.nap?.phone) {
    errors.push(`${file}: nap.phone is "${page.nap.phone}" — expected empty until the corporate number is agreed (gate M-14)`);
  }
  // enquiry_url must stay empty until the corporate CTA decision lands (C-12).
  if (page.nap?.enquiry_url) {
    errors.push(
      `${file}: nap.enquiry_url is "${page.nap.enquiry_url}" — expected empty. C-12: the corporate ` +
      `front door must not funnel into one division by default (gate MAIN-G3).`
    );
  }

  if (page.status && !['approved', 'published'].includes(page.status)) {
    warnings.push(`${file}: status is "${page.status}" (not approved/published)`);
  }
}

for (const w of warnings) console.warn(`WARN  ${w}`);

if (errors.length) {
  console.error(`\ncontent-check: FAILED — ${errors.length} error(s) across ${files.length} page(s):`);
  for (const e of errors) console.error(`  ✖ ${e}`);
  process.exit(1);
}

console.log(`content-check: OK — ${files.length} page(s) clean (site: main, origin: ${ORIGIN}).`);
