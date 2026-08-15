# Agency Wording Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace abstract homepage language with concrete, defensible wording based on how strong creative studios and technology consultancies describe actions, outputs and engagement modes.

**Architecture:** Keep the existing visual layout and legal data. Update service data and homepage headings in place, then extend the static bundle contract so the new concrete value proposition is required and the retired generic phrases cannot return.

**Tech Stack:** Astro, TypeScript data module, Node static bundle assertions, Playwright responsive QA.

## Global Constraints

- Keep IT and ART distinct; do not manufacture a generic “tech + creativity” fusion claim.
- Name actions and deliverables: diagnose, architect, instrument, prototype, direct, model, produce and transmit.
- Do not copy source-agency sentences.
- Remove “transformer la complexité”, “même exigence de fond”, “rendre la valeur visible”, “lecture senior”, “qualité perçue” and “mettre en valeur”.
- Preserve `amine@itart.studio`, legal content, static JavaScript-free output and all existing URLs.

---

### Task 1: Encode the editorial contract

**Files:**
- Modify: `scripts/review-static-site.mjs`

**Interfaces:**
- Consumes: generated `dist/index.html`.
- Produces: build-time assertions for concrete value proposition and retired phrases.

- [ ] **Step 1: Add failing assertions**

Require the bundle to include `Conseil technique. Direction créative. Production.`, `une architecture, un prototype, une équipe formée, une image ou une collection`, `Comprendre le système. Construire ce qui doit fonctionner.` and `Définir un langage. Produire les images et les objets.`. Assert that each retired generic phrase is absent.

- [ ] **Step 2: Run the contract and verify failure**

Run: `npm run build`

Expected: FAIL because the current homepage still contains the retired copy and does not contain the new value proposition.

### Task 2: Rewrite services and method

**Files:**
- Modify: `src/data/site.ts`

**Interfaces:**
- Consumes: the existing `Service` and `MethodStep` interfaces.
- Produces: concrete service descriptions and the `Cadrer`, `Produire`, `Transmettre` method sequence rendered by `src/pages/index.astro`.

- [ ] **Step 1: Replace IT descriptions**

Use the approved research wording for observability, architecture/cloud/delivery, AI prototypes and training, keeping each description focused on the work performed and what remains usable.

- [ ] **Step 2: Replace ART descriptions**

Rename the first ART service to `Direction visuelle et design 3D`; describe volumes, sets, objects, lighting, material, framing and movement. Rename the second to `Contenus et collections`; describe coherent series, objects/images and dissemination formats.

- [ ] **Step 3: Replace the three method steps**

Use `Cadrer`, `Produire`, `Transmettre` with explicit outputs embedded in each description.

### Task 3: Rewrite homepage framing copy

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: updated data from `src/data/site.ts`.
- Produces: final visible homepage copy without layout or URL changes.

- [ ] **Step 1: Rewrite hero copy**

Use `Comprendre le système. Construire ce qui doit fonctionner.` for IT; `Définir un langage. Produire les images et les objets.` for ART; `Conseil technique. Direction créative. Production.` for the central line; and `Voir la pratique IT/ART` for links.

- [ ] **Step 2: Rewrite activity and services introductions**

Define IT Art Studio as an independent consulting and production studio, name the exact IT and ART fields, and lead the services section with the usable-deliverable principle.

- [ ] **Step 3: Rewrite method and CTA framing**

Use `Un déroulé lisible, quel que soit le projet.` and the concrete CTA question `Un système à fiabiliser, un prototype à tester ou une direction visuelle à produire ?` followed by `Écrire au studio` while retaining the canonical email link.

- [ ] **Step 4: Run the contract and verify success**

Run: `npm run build`

Expected: PASS; the static review confirms all required concrete phrases and no retired phrases.

### Task 4: Responsive and source verification

**Files:**
- Test: `scripts/qa-static.mjs`
- Test: `scripts/review-static-source.mjs`

**Interfaces:**
- Consumes: final source and generated static bundle.
- Produces: QA evidence for desktop, tablet, mobile and legal pages.

- [ ] **Step 1: Run source diagnostics**

Run: `npm run check`

Expected: `0 errors`, `0 warnings`, `0 hints`, and the static source contract passes.

- [ ] **Step 2: Run responsive QA**

Run: `npm run qa:static`

Expected: five screenshots, zero horizontal overflow and zero browser errors at 1440, 768, 390 and 320 pixels plus the mobile legal page.

- [ ] **Step 3: Commit the wording**

```bash
git add scripts/review-static-site.mjs src/data/site.ts src/pages/index.astro
git commit -m "copy: make studio services concrete"
```
