# Continuous Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the homepage around one continuous ART-left / IT-right vertical axis while preserving the approved copy and hero video behavior.

**Architecture:** A document-level CSS pseudo-element owns the single vertical axis. Homepage sections use explicit two-column semantic wrappers aligned to the same 50% midpoint; reference data is split into ART and IT collections so future ART names can be added without changing markup.

**Tech Stack:** Astro, TypeScript data, CSS, Node.js source contracts, Playwright browser QA.

## Global Constraints

- ART occupies the left half and IT occupies the right half on desktop and tablet.
- One one-pixel axis runs from the top to the bottom of the document.
- Hero word order is IT, ART, STUDIO; IT is right, ART is left, and STUDIO is centered below.
- Remove “Conseil technique. Direction créative. Production.” from the hero.
- Preserve all other approved wording, service descriptions, reference names and hero scroll behavior.
- Method and contact sections use the existing dark background and brand colors; no light section background remains.
- The ART reference collection is empty and renders no placeholder or future promise.
- Mobile art direction is deferred, but 320 px must retain zero horizontal overflow.
- Add no dependencies, external assets, cards, carousels or decorative gradients.

---

### Task 1: Lock the split-layout contract

**Files:**
- Modify: `scripts/review-static-source.mjs`

**Interfaces:**
- Consumes: `src/pages/index.astro`, `src/data/site.ts` and `src/styles/global.css` source strings.
- Produces: assertions for the hero structure, removed strapline, continuous axis, practice order and split reference data.

- [ ] **Step 1: Add failing assertions**

Add source checks for these contracts:

```js
assert(homeSource.includes('<span class="hero-title__it">IT</span>'));
assert(homeSource.includes('<span class="hero-title__art">ART</span>'));
assert(homeSource.includes('<strong class="hero-title__studio">STUDIO</strong>'));
assert(!homeSource.includes("Conseil technique. Direction créative. Production."));
assert(homeSource.indexOf('practice-services--art') < homeSource.indexOf('practice-services--it'));
assert(siteDataSource.includes("art: []"));
assert(styleSource.includes("body::before"));
assert(styleSource.includes("left: 50%"));
```

- [ ] **Step 2: Run the source contract and verify RED**

Run: `npm run review:source`

Expected: FAIL because the hero title does not have the new classes and the strapline is still present.

### Task 2: Recompose the homepage around the axis

**Files:**
- Modify: `DESIGN.md`
- Modify: `src/data/site.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Test: `scripts/review-static-source.mjs`

**Interfaces:**
- Consumes: `references.art` and `references.it` from `src/data/site.ts`.
- Produces: a single document axis and two-column homepage sections aligned to ART-left / IT-right.

- [ ] **Step 1: Split reference data by practice**

Replace the flat array with:

```ts
export const references = {
  art: [],
  it: [
    "bioMérieux",
    "Axxès",
    "GCA Groupe Charles André",
    "KeyIA",
    "Enedis",
    "Ylio",
    "Odigo"
  ]
} as const;
```

- [ ] **Step 2: Rebuild semantic homepage wrappers**

Update the hero title to ordered classed spans and remove its supporting paragraph. Split the activity copy into `.activity-practice--art` and `.activity-practice--it`. Render ART services before IT services inside `.practice-columns`. Render `.references-practice--art` without a list when `references.art` is empty and render the IT names from `references.it`. Wrap the existing contact copy into `.contact-section__intro` and `.contact-section__action`.

- [ ] **Step 3: Align header and footer with the same midpoint**

Keep the existing header and footer content, but update their layout so the brand/legal information stays left of the axis and navigation/contact information stays right of it. Do not add or remove navigation destinations.

- [ ] **Step 4: Implement the single CSS axis and dark split sections**

Use `body::before` as the only page axis:

```css
body::before {
  position: absolute;
  inset: 0 auto 0 50%;
  z-index: 4;
  width: 1px;
  background: var(--line-strong);
  content: "";
  pointer-events: none;
}
```

Remove the hero-local rule. Use equal columns and paired center gutters for activity, services, references, method, contact, header and footer. Restore `var(--void)` for the method background and `var(--ink)` / `var(--ink-soft)` for its text. Keep the existing mobile breakpoint functional without introducing a new mobile concept.

- [ ] **Step 5: Update the design contract**

Revise `DESIGN.md` so it states ART-left / IT-right, the continuous document axis, the dark-only section system and the deferred mobile art direction.

- [ ] **Step 6: Run the source contract and verify GREEN**

Run: `npm run review:source`

Expected: `Static source contract is complete.`

- [ ] **Step 7: Run full automated verification**

Run: `npm run check`

Expected: zero Astro errors, warnings and hints.

Run: `npm run build`

Expected: the static production build and site contracts pass.

Run: `npm run qa:static`

Expected: zero browser errors and zero horizontal overflow on desktop, tablet, 390 px and 320 px.

- [ ] **Step 8: Inspect the live composition**

Capture the hero plus representative activity, services, references, method and contact sections at 1440 px and 768 px. Confirm visually that the same axis remains aligned, no content crosses it, ART is left, IT is right, and no light section remains.

- [ ] **Step 9: Run the design detector and commit**

Run:

```bash
node /Users/amine/.codex/skills/impeccable/scripts/detect.mjs --json \
  src/pages/index.astro src/layouts/BaseLayout.astro src/styles/global.css
```

Expected: no new design-rule violations.

Commit:

```bash
git add DESIGN.md scripts/review-static-source.mjs src/data/site.ts \
  src/pages/index.astro src/layouts/BaseLayout.astro src/styles/global.css
git commit -m "refactor: align site to continuous split axis"
```
