# netyvee/main — Vigil Services Ltd corporate site

The parent-company front door for **vigilservices.co.uk**, built on the shared
`@vigil/web-framework` render-from-JSON engine. Content is owned by the Vigil CRM
(`netyvee/app`) and published into `content/pages/*.json`; this repo holds the engine
wiring and configuration, not copy.

**Status: MAIN-01 Phase A — pilot scaffold. Not live. No DNS change. The existing
WordPress site at vigilservices.co.uk remains authoritative and untouched.**

## What this repo is, and why it exists now

`netyvee/main` was an entirely empty repository — 0 commits — while a merged audit
recorded a verdict about migrating onto it. Correcting that produced two verdicts
(`D-092` in the CRM):

| | |
|---|---|
| Architectural fitness of `web-framework` for this site | **GREEN** |
| Operational readiness to migrate today | **RED** — because this repo did not exist in any usable form |

The corporate site is the best fit in the estate for this framework: **5 pages,
0 blog posts, a flat navigation with no dropdowns, and no enquiry form.** The three
capability gaps that block converting the cleaning and security sites — markdown blog,
wider structured-data coverage, dropdown navigation — are things this site does not use.

## Architecture

Identical to `netyvee/care` and `netyvee/staffing` by design:

- `app/[[...slug]]/page.tsx` — the only page route. Byte-identical to care/staffing.
  Everything corporate lives in **data**, never in the renderer.
- `content/pages/*.json` — published by the CRM. Do not hand-edit.
- `config/site.ts` — navigation, brand assets, company registration. **No NAP here.**
- `scripts/content-check.mjs` — the corporate content gate (see below).

### Framework pin

```
"@vigil/web-framework": "github:netyvee/web-framework#v0.4.11"
```

Pinned to an **exact immutable tag**, resolving to commit
`ee38baee5d13887b141212d1ee25249f20417c50` in `package-lock.json`. Never `#main`
(forbidden by the framework's `docs/PUBLISHING.md`), never a range.

`v0.4.11` was cut *for* this repo: the Shell previously rendered the phone link and
enquiry CTA unconditionally, which on a site with neither produced `<a href="tel:"></a>`
and `<a href="">` — a dead contact link and an enquiry button that reloads the page.
Both are now guarded. Division sites are unaffected.

## How this site differs from a division site

**The division rules invert here.** On cleaning/security/care/staffing, linking to
another division is forbidden. Here it is the whole purpose — this is the group's own
site and presenting all four businesses is correct. This is also the only site where
the legal entity and company number appear in full by design.

**No division phone.** The live WordPress site currently shows `020 3973 8887` as its
contact number — that is the **Care Staffing** number, not a corporate one. Presenting
it here would be a genuine cross-division NAP leak on the group's own site.
`scripts/content-check.mjs` fails the build if any division phone appears.

**No enquiry CTA.** `main.enquiry_url` in the CRM registry is deliberately empty. It
used to point at `/enquire/cleaning`, funnelling the entire group into one division
(tracked as `C-12` since 2026-07-02, closed 2026-07-20). What replaces it — one general
inbox, or a "choose a business" hand-off — is a founder decision.

## The pilot page

`/pilot-render-check` is a **non-production route**, `noindex` in both its page JSON and
`robots.ts`. It exists to prove one thing the estate has never had evidence for: that
content approved in the CRM actually **renders** on the deployed site.

That matters because the CRM currently reports "published" on nothing more than an
accepted GitHub commit — no consumer check, no build check, no render check
(`PUB-01` in the CRM). So `.github/workflows/qa.yml` greps the prerendered HTML for a
marker string carried in the page JSON. If the content did not render, the gate fails
even when everything upstream is green.

**Why not migrate a real page first?** The obvious candidate, `/about-vigil-services-ltd/`,
carries claims the governance forbids — *"Since 2019 we worked for 100+ clients across
UK"*, *"100+ Happy Customers"*, and testimonials attributed to apparent theme-placeholder
names. Publishing those verbatim would ship forbidden claims; rewriting them is
founder-owned content, not an engineering decision. Real-page migration is gated on that.

## Known gaps, recorded rather than hidden

- **No Vercel project.** Nothing is deployed. Founder gate (third-party account).
- **No analytics.** The live site runs GA4 `G-KTH8TMCHTT`; the framework has no analytics
  integration. Must be carried deliberately at cutover.
- **No cookie consent.** The live site fires GA4 unconditionally with no consent banner —
  a UK PECR/GDPR exposure. To be **fixed** at rebuild, never replicated.
- **No legal pages.** The live corporate footer links to privacy / modern-slavery /
  equal-opportunities pages hosted on the *staffing* subdomain, and there is no terms of
  service and no cookie policy anywhere in the estate.
- **No redirect map.** Built at cutover from the union of the Rank Math sitemap, a live
  crawl, and Search Console indexed pages — never hand-typed, which is how migrations
  lose orphan ranking pages.
- **No corporate OG image, no logo asset.** Brand decisions.

## CI note — push-triggered runs were binding to a ghost workflow

The first four pushes to this repository all produced `startup_failure` with no jobs and
no check-runs. Diagnosis, recorded so the next session does not repeat it:

| Check | Result |
|---|---|
| YAML valid? | **Yes** — parses identically to `netyvee/care`'s `qa.yml` (same top-level keys, same job, 6 steps) |
| BOM / CRLF / tabs? | None |
| Actions enabled? | **Yes** — `enabled: true`, `allowed_actions: all` |
| Workflow registered? | **Yes** — `316394152`, `QA Gate`, `state=active` |
| Runs attributed to? | **`316395111` — a workflow ID that does not exist in `/actions/workflows`** |

Every push-triggered run was bound to a **workflow ID that was not the registered one**.

**Then the ghost-workflow theory was itself disproved.** A `workflow_dispatch` against the
*correct* workflow ID (`316394152`) queued a run — and that run **also ended in
`startup_failure`**. So the mismatched ID is a symptom, not the cause.

**The actual cause, and it is server-side:**

```
gh api repos/netyvee/main --jq .size   →  0
```

GitHub reports this repository as **size 0** despite six pushed commits. Its own contents
API lists every file and `branches/main` resolves to the correct head, so **the code is
genuinely there** — but GitHub's repository metadata has not ingested it. From the
runner's point of view there is nothing to check out, which is exactly why no run can
start, by push or by dispatch. GitHub's status page reported a *Minor Service Outage*
throughout the window this repository was created.

**Nothing here needs fixing in this repo.** The remedy is to re-dispatch once the incident
clears and `size` is non-zero. If it persists after that, force re-registration by
renaming the workflow file.

> Recorded this way deliberately: the first version of this note claimed dispatch "works
> and proves the file is fine", written while the dispatched run was still *queued*. It
> then failed. Treating a queued run as evidence is the same error this repository's own
> pilot exists to eliminate — a signal read before it means anything.

## Local development

```bash
npm install
npm run check:content   # corporate content gate
npm run build           # production build
npm run dev             # http://localhost:3000
```

## Governing records (in `netyvee/app`)

`AUDIT/CORPORATE-MAIN-SITE-MIGRATION-AUDIT.md` · `ENGINEERING-OS/TASKS/MAIN-01.yml` ·
`ENGINEERING-OS/TASKS/PUB-01.yml` · `ENGINEERING-OS/TASKS/WF-GOV-01.yml` ·
`AUDIT/MAIN-BENCHMARK-SPINE-PLAN.md` · `D-092` in `ENGINEERING-OS/DECISION-AUTHORITY.md`
