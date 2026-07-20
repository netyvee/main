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

## CI note — Actions cannot start runs here (GitHub incident, 2026-07-20)

**Every** run in this repository has ended in `startup_failure` — push and
`workflow_dispatch` alike. Diagnosed to conclusion so the next session does not repeat it.

### Ruled out, in order

| Hypothesis | Test | Verdict |
|---|---|---|
| `qa.yml` is malformed | Parsed with `js-yaml` against `netyvee/care`'s working `qa.yml` — same top-level keys, same job, 6 steps. No BOM, no CRLF, no tabs | **Not the cause** |
| Actions disabled / restricted | `enabled: true`, `allowed_actions: all`, `default_workflow_permissions: read` — **byte-identical** to `netyvee/web-framework`, which ran fine the same night | **Not the cause** |
| Ghost workflow registration | Runs were attributed to workflow `316395111`, which is absent from `/actions/workflows` (registered id is `316394152`). Dispatching the **correct** id still produced `startup_failure` | **Symptom, not cause** |
| Repository not ingested | `gh api repos/netyvee/main --jq .size` returned **0** despite pushed commits. It later became **27**, and the run `path` began resolving to `qa.yml` correctly — **and runs still failed** | **Real, but not the whole cause** |
| Something specific to `qa.yml` | Added `smoke.yml`: ten lines, no `concurrency`, no actions, no expressions. **It also failed at startup** | **Conclusive — the file is exonerated** |
| Broken Actions provisioning | Toggled Actions off → on via the API, re-dispatched | **Did not resolve it** — post-toggle run `29711871762` sat `queued` for several minutes (unlike the earlier immediate failures) and then ended `startup_failure` |

### The actual cause

```
githubstatus.com/api/v2/summary.json
  status:    Minor Service Outage
  Actions:   partial_outage
  incident:  "Incident with GitHub Actions" — investigating
```

An **active GitHub Actions incident**, still open at the time of writing. `partial_outage`
explains why `netyvee/app` and `netyvee/web-framework` ran normally the same night while
this repository could not start a single run — some capacity was serving, some was not.

**There is nothing to fix in this repository.** Re-dispatch once the incident closes:

```
gh api -X POST repos/netyvee/main/actions/workflows/316413471/dispatches -f ref=main   # smoke
gh api -X POST repos/netyvee/main/actions/workflows/316394152/dispatches -f ref=main   # QA Gate
```

`smoke.yml` is kept deliberately: it is the cheapest possible "can Actions run here at all"
probe, and it is what turned this from a theory into a bisect.

> **Process note on the row above, recorded because the pattern matters more than the row.**
> That verdict was first written while run `29711871762` was still **queued**. It later
> completed as `startup_failure`, so the conclusion was right — but it was not *justified*
> when written, and being accidentally right is not the same thing. It is now backed by the
> completed run.
>
> That is the **third** time in one session I filled in a result from expectation rather
> than observation, and the second time inside this very file — including in the table
> directly above the paragraph warning against exactly that. The mechanism is consistent:
> reaching for a tidy, complete-sounding narrative and completing the last cell before the
> evidence lands. Worth naming, because it is the same shape as
> `GOC-GENERATE-SILENT-FAILURE-01` — a confident signal carrying no proof.

> **Two of my own earlier explanations in this file were wrong and are corrected above.**
> The first claimed `workflow_dispatch` "works and proves the file is fine" — written while
> the dispatched run was still *queued*; it then failed. The second blamed repository
> ingestion alone — real, but runs kept failing after it recovered. Both are left visible
> rather than quietly replaced, because reading a signal before it means anything is the
> exact failure this repository's pilot page exists to eliminate.

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
