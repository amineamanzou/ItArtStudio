# IT Art Studio Static Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current WebGL experience with a production-ready static showcase and publish it at `https://itart.studio` through the same immutable-image delivery model as AmineAmanzouWebsite.

**Architecture:** Astro emits two JavaScript-free HTML pages and local optimized imagery. A hardened Caddy image serves the build on port 8080; GitHub Actions scans, signs and promotes the immutable image; TheUnreliableInfrastructure deploys the digest to `web-prod`, while the existing `itart.studio` Cloudflare Terraform stack publishes apex and `www` records.

**Tech Stack:** Astro 6, TypeScript, local CSS, Playwright, Node.js 22/26, Caddy 2.11, Docker, GitHub Actions, GHCR, Cosign, Trivy, Argo Workflows, Ansible, Terraform, Cloudflare DNS.

## Global Constraints

- Keep the interactive world on `codex/interactive-world-v10-archive`; do not delete that branch.
- Use `IT Art Studio` as the displayed legal name and `amine@itart.studio` for every contact CTA.
- Publish no placeholder, `href="#"`, broken internal link, unverified social link or “bientôt disponible” copy.
- Keep the first production release image-only; video generation is a later progressive enhancement.
- Emit no Three.js, GSAP, Lenis, WebGL, tracker, cookie banner or client-side network request.
- Preserve a visually balanced IT/ART split and an approximately 60/40 commercial emphasis toward IT.
- Meet WCAG AA contrast, visible keyboard focus, 44 px touch targets and a correct layout at 320, 390, 768 and 1440 px.
- Do not declare rollout complete before public DNS, HTTPS, HTTP-to-HTTPS redirect, `www` redirect, `/healthz`, home and legal page checks pass.

---

## File Structure

### ItArtStudio

- `src/data/site.ts`: typed company, navigation, service and method copy.
- `src/layouts/BaseLayout.astro`: metadata, canonical URL, favicon, header/footer shell.
- `src/pages/index.astro`: home sections and split hero.
- `src/pages/mentions-legales.astro`: complete legal notice.
- `src/pages/robots.txt.ts`: production robots contract.
- `src/pages/sitemap.xml.ts`: two-URL XML sitemap.
- `src/styles/global.css`: complete dark split system and responsive behavior.
- `public/assets/hero-it.{avif,webp,jpg}`: generated IT scene.
- `public/assets/hero-art.{avif,webp,jpg}`: generated ART scene.
- `scripts/review-static-site.mjs`: deterministic output and copy assertions.
- `scripts/qa-static.mjs`: link crawl and responsive screenshots.
- `ops/Caddyfile`: static runtime, `/healthz`, compression and headers.
- `Dockerfile`: reproducible build and unprivileged Caddy runtime.
- `.github/workflows/ci.yml`: site and container gates.
- `.github/workflows/deploy-production.yml`: signed immutable GHCR publication.
- `package.json` and `package-lock.json`: remove interactive dependencies and expose static checks.
- `README.md`, `PRODUCT.md`, `DESIGN.md`: current product and operating direction.

### TheUnreliableInfrastructure

- `runtime/web/sites/itart-studio/compose.yaml`: dedicated service overlay.
- `runtime/web/sites-enabled/31-itart-studio.caddy`: apex route and canonical `www` redirect.
- `runtime/argo-workflows/itart-studio-website-pull-deploy.yaml`: digest pull/deploy workflow.
- `roles/web_runtime/templates/release.env.j2`: `ITART_STUDIO_WEBSITE_IMAGE`.
- `roles/web_runtime/tasks/main.yml`: digest contract assertion.
- `roles/bastion_argo_workflows/templates/the-unreliable-web-release.j2`: release target mapping.
- `inventories/prod/group_vars/all.yml`: poller, workflow and compose registrations.
- `inventories/prod/group_vars/web.yml`: runtime compose and default image contract.
- `runtime/web/compose.yaml`: IT Art route environment and Caddy dependency.
- `tests/test_itart_static_contract.py`: complete runtime contract tests.

### nas-wireguard-infra

- `stacks/cloudflare-dns/main.tf`: public apex and `www` A records.
- `scripts/test-itart-web-dns-contract.sh`: deterministic DNS contract test.
- `docs/cloudflare-dns.md`: public web record documentation.

---

### Task 1: Static Output Contract

**Files:**
- Create: `scripts/review-static-site.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/assert-production-bundle.mjs`

**Interfaces:**
- Consumes: generated `dist/index.html` and `dist/mentions-legales/index.html`.
- Produces: `npm run review:site`, which exits 0 only when the public contract is complete.

- [ ] **Step 1: Write the failing output review**

Create a Node script that reads both HTML files, recursively inventories `dist`, and asserts these exact invariants:

```js
assert(home.includes("IT Art Studio"), "home missing legal name");
assert(home.includes("mailto:amine@itart.studio"), "home missing contact");
assert(legal.includes("Société à responsabilité limitée"), "legal page missing SARL");
assert(legal.includes("915 019 129"), "legal page missing SIREN");
assert(!bundle.includes("three"), "interactive dependency leaked into bundle");
assert(!bundle.includes("contact@itart.studio"), "legacy contact leaked into bundle");
assert(!/href=["']#["']/i.test(bundle), "placeholder href leaked into bundle");
assert(!/bient[oô]t disponible/i.test(bundle), "placeholder copy leaked into bundle");
```

- [ ] **Step 2: Prove the review fails against the current site**

Run: `npm run build && node scripts/review-static-site.mjs`

Expected: FAIL because the current home uses `contact@itart.studio`, imports the game and has no legal page.

- [ ] **Step 3: Replace interactive dependencies and scripts**

Remove `three`, `@types/three`, `gsap` and `lenis`. Replace game QA scripts with:

```json
{
  "review:site": "node scripts/review-static-site.mjs",
  "qa:static": "node scripts/qa-static.mjs",
  "check": "astro check && npm run review:source",
  "review:source": "node scripts/review-static-source.mjs",
  "build": "astro build && node scripts/assert-production-bundle.mjs && npm run review:site"
}
```

Add `scripts/review-static-source.mjs` to reject imports from `src/game`, placeholder links and the legacy contact before a build.

- [ ] **Step 4: Refresh the lockfile and verify the dependency graph**

Run: `npm install --package-lock-only && npm ls three gsap lenis`

Expected: lockfile updates successfully and `npm ls` reports no installed interactive dependency.

- [ ] **Step 5: Commit the contract**

```bash
git add package.json package-lock.json scripts/assert-production-bundle.mjs scripts/review-static-site.mjs scripts/review-static-source.mjs
git commit -m "test: define static showcase contract"
```

### Task 2: Semantic Pages and Legal Content

**Files:**
- Create: `src/data/site.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Replace: `src/pages/index.astro`
- Create: `src/pages/mentions-legales.astro`
- Create: `src/pages/robots.txt.ts`
- Create: `src/pages/sitemap.xml.ts`

**Interfaces:**
- Produces: `company`, `services`, `methodSteps` and `navigation` exports consumed by both pages.
- Produces: `/`, `/mentions-legales/`, `/robots.txt` and `/sitemap.xml`.

- [ ] **Step 1: Add source-level content assertions**

Extend `review-static-source.mjs` to require the six service labels, the address, `FR79 915019129`, both publication directors and the canonical contact.

- [ ] **Step 2: Run the source review and confirm failure**

Run: `npm run review:source`

Expected: FAIL because `src/data/site.ts` and the legal page do not exist.

- [ ] **Step 3: Implement typed site data**

Define:

```ts
export interface Service {
  id: string;
  practice: "IT" | "ART";
  index: string;
  title: string;
  description: string;
}

export const company = {
  legalName: "IT Art Studio",
  legalForm: "Société à responsabilité limitée",
  capital: "1 000 €",
  address: "143 rue René Tachon, 69250 Curis-au-Mont-d'Or, France",
  siren: "915 019 129",
  rcs: "Lyon 915 019 129",
  vat: "FR79 915019129",
  email: "amine@itart.studio"
} as const;
```

Populate the six approved services and three method steps exactly from the design spec.

- [ ] **Step 4: Implement the shared layout**

Remove the inline JavaScript and game import. Add canonical, Open Graph URL, theme color, skip-link, compact navigation and a footer that links to `/mentions-legales/`.

- [ ] **Step 5: Implement the home and legal page**

Build the hero, activity statement, services, method and email contact using semantic sections. Build the legal page from `company` and list Hetzner Online GmbH with its current address and contact.

- [ ] **Step 6: Add robots and sitemap endpoints**

Return production URLs rooted at `https://itart.studio`, with exactly two sitemap page locations.

- [ ] **Step 7: Verify source and Astro compilation**

Run: `npm run review:source && npx astro check`

Expected: PASS.

- [ ] **Step 8: Commit semantic content**

```bash
git add src/data/site.ts src/layouts/BaseLayout.astro src/pages
git commit -m "feat: add static studio content and legal notice"
```

### Task 3: Higgsfield Imagery and Dark Split Design

**Files:**
- Create: `public/assets/hero-it.avif`
- Create: `public/assets/hero-it.webp`
- Create: `public/assets/hero-it.jpg`
- Create: `public/assets/hero-art.avif`
- Create: `public/assets/hero-art.webp`
- Create: `public/assets/hero-art.jpg`
- Replace: `src/styles/global.css`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: two completed Nano Banana Pro image jobs.
- Produces: two `<picture>` elements with AVIF, WebP and JPEG fallback sources.

- [ ] **Step 1: Generate the IT image in Higgsfield**

Use model `nano_banana_pro`, aspect ratio `16:9`, count `1`, with this prompt:

```text
Use case: photorealistic-natural
Asset type: dark editorial website hero, IT half of a paired diptych
Scene/backdrop: a precise architectural studio at night, deep graphite and blue-black surfaces
Subject: abstract observability traces, restrained cyan light paths, a physical systems blueprint and one sculptural server-like object
Style/medium: premium cinematic product photography, tactile real materials, no futuristic dashboard
Composition/framing: wide 16:9, strong negative space toward the inner right edge where the STUDIO seam will meet
Lighting/mood: controlled low-key light, calm, senior, exact
Constraints: no text, no logo, no people, no brand, no UI screenshot, no watermark
```

- [ ] **Step 2: Generate the ART image in Higgsfield**

Use model `nano_banana_pro`, aspect ratio `16:9`, count `1`, with this prompt:

```text
Use case: photorealistic-natural
Asset type: dark editorial website hero, ART half of a paired diptych
Scene/backdrop: a precise creative atelier at night, deep graphite and warm black surfaces
Subject: folded dark textile, a sculptural 3D form, pattern paper, copper tool and restrained coral light
Style/medium: premium cinematic product photography, tactile real materials, same lens and visual density as the IT image
Composition/framing: wide 16:9, strong negative space toward the inner left edge where the STUDIO seam will meet
Lighting/mood: controlled low-key light, calm, crafted, exact
Constraints: no text, no logo, no people, no brand, no fashion model, no watermark
```

- [ ] **Step 3: Inspect both results and regenerate only if a hard constraint fails**

Reject images containing text, logos, identifiable people, visible brand hardware, a generic neon-SaaS look or mismatched lighting. Keep one accepted job per side.

- [ ] **Step 4: Download and optimize accepted images**

Save originals outside `public`, then produce the six public files. Target dimensions: 1920×1080; target sizes: AVIF ≤ 300 KB, WebP ≤ 450 KB, JPEG ≤ 700 KB. Verify with `file` and `du -h`.

- [ ] **Step 5: Write the split design CSS**

Implement desktop 50/50 image composition, central STUDIO axis, cyan/copper practice markers, editorial services grid, contact panel and legal page. At `max-width: 760px`, stack the practices and convert the vertical axis to a horizontal transition. At `prefers-reduced-motion: reduce`, disable all transforms and transitions.

- [ ] **Step 6: Build and run output review**

Run: `npm run build`

Expected: PASS and no JavaScript module emitted by the page shell.

- [ ] **Step 7: Commit imagery and design**

```bash
git add public/assets/hero-* src/pages/index.astro src/styles/global.css
git commit -m "feat: add dark split studio design"
```

### Task 4: Responsive and Link QA

**Files:**
- Create: `scripts/qa-static.mjs`
- Modify: `.gitignore`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `qa/artifacts/static/{desktop,tablet,mobile,mobile-320,legal}.png` and a JSON report.

- [ ] **Step 1: Write the failing browser QA**

Use Playwright to serve `dist`, visit every internal link, fail on console/page errors, assert zero horizontal overflow and capture 1440×1000, 768×1024, 390×844 and 320×800.

Core assertions:

```js
expect(await page.locator("h1").count()).toBe(1);
expect(await page.locator('a[href="mailto:amine@itart.studio"]').count()).toBeGreaterThan(0);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```

- [ ] **Step 2: Run QA and confirm any layout failures**

Run: `npm run build && npm run qa:static`

Expected before final CSS adjustments: report identifies any overflow or collision rather than silently passing.

- [ ] **Step 3: Fix only evidenced responsive defects**

Adjust breakpoints, wrapping and image crops based on screenshots. Do not add new visual features.

- [ ] **Step 4: Re-run QA at all viewports**

Run: `npm run qa:static`

Expected: PASS, five screenshots and report with zero broken links, zero console errors and zero overflow.

- [ ] **Step 5: Commit QA**

```bash
git add scripts/qa-static.mjs .github/workflows/ci.yml .gitignore src/styles/global.css
git commit -m "test: verify static site across viewports"
```

### Task 5: Production Image and Release Workflow

**Files:**
- Create: `ops/Caddyfile`
- Replace: `Dockerfile`
- Delete: `nginx.conf`
- Create: `.github/workflows/deploy-production.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: `ghcr.io/amineamanzou/it-art-studio@sha256:<digest>` and promoted tag `main`.
- Exposes: HTTP port 8080 and `/healthz` inside the container.

- [ ] **Step 1: Add a failing container contract to CI**

Require `/`, `/mentions-legales/` and `/healthz` to return 200; require `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and no `Server` header.

- [ ] **Step 2: Replace Nginx with the Caddy runtime**

Mirror AmineAmanzouWebsite's unprivileged static Caddy pattern, but keep only static serving, compression, security headers and `/healthz`. Pin base images by digest during implementation.

- [ ] **Step 3: Prove the local container contract**

Run:

```bash
docker build -t it-art-studio:local .
docker run --rm -d --name it-art-studio-local -p 8080:8080 it-art-studio:local
curl -fsS http://127.0.0.1:8080/healthz
curl -fsSI http://127.0.0.1:8080/mentions-legales/
docker stop it-art-studio-local
```

Expected: both checks pass and the container becomes healthy.

- [ ] **Step 4: Add production release workflow**

Adapt the AmineAmanzouWebsite workflow to: install, audit, check, build, run static review, build a SHA-tagged image, scan the exact digest with Trivy, publish SBOM, sign with Cosign, attest provenance/SBOM and promote the verified digest to `main` without rebuilding.

- [ ] **Step 5: Document production and rollback**

Update README with the public URL, local commands, image repository, digest-only runtime contract and the archive branch.

- [ ] **Step 6: Run the full local verification**

Run: `npm ci && npm audit --audit-level=moderate && npm run check && npm run build && npm run qa:static`

Expected: PASS.

- [ ] **Step 7: Commit production delivery**

```bash
git add Dockerfile ops/Caddyfile .github/workflows README.md
git rm nginx.conf
git commit -m "ci: publish immutable IT Art Studio image"
```

### Task 6: web-prod Runtime and Argo Deployment

**Files:**
- Create and modify the TheUnreliableInfrastructure files listed in the File Structure section.

**Interfaces:**
- Consumes: `ghcr.io/amineamanzou/it-art-studio@sha256:<digest>`.
- Produces: Caddy route `itart.studio` → `itart-studio-website:8080` and canonical `www` redirect.

- [ ] **Step 1: Create `codex/itart-static-production` in TheUnreliableInfrastructure**

Confirm the worktree is clean, create the branch, and do not modify unrelated runtime services.

- [ ] **Step 2: Write failing infrastructure contract tests**

Create `tests/test_itart_static_contract.py` asserting:

```py
self.assertIn("ITART_STUDIO_WEBSITE_IMAGE", release_env)
self.assertIn("itart-studio-website:", compose)
self.assertIn("itart.studio", caddy_site)
self.assertIn("www.itart.studio", caddy_site)
self.assertIn("itart-studio-website-pull-deploy", workflow)
self.assertIn("ghcr.io/amineamanzou/it-art-studio", release_script)
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `python3 -m unittest tests.test_itart_static_contract -v`

Expected: FAIL because the runtime contract does not yet exist.

- [ ] **Step 4: Add compose and Caddy route**

Create a read-only, capability-dropped service with a `/healthz` healthcheck. Add `ITART_STUDIO_HOSTS`, `ITART_STUDIO_UPSTREAM` to the root compose and route apex to the service while redirecting `www` to `https://itart.studio{uri}`.

- [ ] **Step 5: Add digest release wiring**

Register the compose overlay, release env, image regex, release-script case, poller mapping and Argo workflow by adapting the AmineAmanzouWebsite contract with names changed consistently to `itart-studio-website` and `it-art-studio`.

- [ ] **Step 6: Run focused and repository validation**

Run:

```bash
python3 -m unittest tests.test_itart_static_contract -v
python3 -m unittest tests.test_amineamanzou_static_contract tests.test_cicd_contract -v
docker compose -f runtime/web/compose.yaml -f runtime/web/sites/itart-studio/compose.yaml config
```

Expected: PASS without changing existing site behavior.

- [ ] **Step 7: Commit infrastructure runtime**

```bash
git add runtime roles inventories tests/test_itart_static_contract.py
git commit -m "feat: add IT Art Studio production runtime"
```

### Task 7: DNS and Public Rollout

**Files:**
- Modify the nas-wireguard-infra files listed in the File Structure section.

**Interfaces:**
- Consumes: `web-prod` IPv4 `46.225.188.52` and the verified production image digest.
- Produces: public HTTPS site at apex and canonical redirect from `www`.

- [ ] **Step 1: Create `codex/itart-public-web` in nas-wireguard-infra**

Confirm the worktree is clean and preserve existing MX, TXT, VPN, learning and Azure delegation records.

- [ ] **Step 2: Add failing DNS contract test**

The shell test must require Terraform resources for apex and `www`, both DNS-only and both using `var.web_prod_ipv4`.

- [ ] **Step 3: Run the test and confirm failure**

Run: `bash scripts/test-itart-web-dns-contract.sh`

Expected: FAIL because no apex/`www` web A resources exist.

- [ ] **Step 4: Add apex and `www` Terraform records**

Use `cloudflare_record` consistently with the existing stack, `ttl = 1`, `proxied = false`, and do not touch mail records.

- [ ] **Step 5: Validate and plan DNS changes**

Run:

```bash
terraform -chdir=stacks/cloudflare-dns fmt -check
terraform -chdir=stacks/cloudflare-dns validate
./scripts/terraform-cloudflare-dns.sh plan
```

Expected plan: exactly two new A records for apex and `www`, with no delete or replace operation.

- [ ] **Step 6: Commit DNS contract before apply**

```bash
git add stacks/cloudflare-dns/main.tf scripts/test-itart-web-dns-contract.sh docs/cloudflare-dns.md
git commit -m "feat: publish IT Art Studio web DNS"
```

- [ ] **Step 7: Push application and infrastructure branches**

Push `codex/static-showcase`, `codex/itart-static-production` and `codex/itart-public-web`. Merge the application release to `main` first so the signed image exists, then merge/deploy infrastructure, and apply DNS last.

- [ ] **Step 8: Deploy the verified digest**

Wait for the application production workflow, capture its exact digest, then let the registered poller/Argo workflow deploy it. Verify service health on `web-prod` before DNS is applied.

- [ ] **Step 9: Apply the reviewed DNS plan**

Run: `./scripts/terraform-cloudflare-dns.sh apply`

Expected: only the two reviewed records are created.

- [ ] **Step 10: Verify public production**

Run:

```bash
dig +short A itart.studio
dig +short A www.itart.studio
curl -fsSI http://itart.studio
curl -fsSI https://itart.studio
curl -fsSI https://www.itart.studio
curl -fsS https://itart.studio/healthz
curl -fsS https://itart.studio/mentions-legales/ | rg "915 019 129|amine@itart.studio"
```

Expected: both names resolve to `46.225.188.52`; HTTP redirects to HTTPS; apex and legal page return 200; `www` redirects permanently to apex; the certificate is valid.

- [ ] **Step 11: Perform final browser QA in Chrome**

Open the public apex in the explicitly selected Chrome browser, inspect desktop and mobile emulation, click every navigation/contact/legal link, and confirm there is no visual regression or browser console error.

- [ ] **Step 12: Record rollout evidence**

Add the production digest, workflow run, DNS apply summary and verification timestamp to the relevant runbook without storing credentials or private topology.
