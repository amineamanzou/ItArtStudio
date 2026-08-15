# Client References Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive, truthful homepage section listing the seven client references approved by IT Art Studio.

**Architecture:** Store reference names in `src/data/site.ts`, render them semantically from `src/pages/index.astro`, and style the section in the existing global design system. Extend the source contract before implementation so the approved names and wording cannot regress.

**Tech Stack:** Astro, TypeScript, CSS, Node.js source/build review scripts, Playwright browser QA.

## Global Constraints

- Approved names: bioMérieux, Axxès, GCA Groupe Charles André, KeyIA, Enedis, Ylio, Odigo.
- Visible statement: “Des organisations accompagnées sur des projets critiques qui nous font confiance.”
- Do not mention KLETA, OPERA CONSEIL, intermediaries, unsupported outcomes, or former employers.
- Do not add logo files, external links, cards, a carousel, JavaScript, or new dependencies.
- Preserve correct rendering at 320 px and the existing reduced-motion behavior.

---

### Task 1: Lock the references contract

**Files:**
- Modify: `scripts/review-static-source.mjs`

**Interfaces:**
- Consumes: homepage and site data source strings.
- Produces: build-time assertions for `id="references"`, the approved statement, and all seven organization names.

- [ ] **Step 1: Write the failing source assertions**

Add assertions that read `src/data/site.ts` and require:

```js
const references = [
  "bioMérieux",
  "Axxès",
  "GCA Groupe Charles André",
  "KeyIA",
  "Enedis",
  "Ylio",
  "Odigo"
];

assertIncludes(homeSource, 'id="references"', "references section");
assertIncludes(
  homeSource,
  "Des organisations accompagnées sur des projets critiques qui nous font confiance.",
  "approved references statement"
);
references.forEach((name) => assertIncludes(siteDataSource, name, `reference ${name}`));
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `npm run review:source`

Expected: FAIL because the homepage does not yet contain `id="references"`.

- [ ] **Step 3: Commit only after Task 2 is green**

The assertion change is committed with the implementation in Task 2 because a permanently failing contract is not a useful standalone branch state.

### Task 2: Render and verify the references section

**Files:**
- Modify: `src/data/site.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Test: `scripts/review-static-source.mjs`

**Interfaces:**
- Consumes: `references: readonly string[]` exported by `src/data/site.ts`.
- Produces: `<section class="references-section" id="references">` containing an `h2` and a semantic list.

- [ ] **Step 1: Add the approved source data**

Export the immutable list:

```ts
export const references = [
  "bioMérieux",
  "Axxès",
  "GCA Groupe Charles André",
  "KeyIA",
  "Enedis",
  "Ylio",
  "Odigo"
] as const;
```

- [ ] **Step 2: Render semantic homepage markup**

Import `references` in `src/pages/index.astro` and place this section between services and method:

```astro
<section class="references-section" id="references" aria-labelledby="references-title">
  <header>
    <p>Références</p>
    <h2 id="references-title">Des organisations accompagnées sur des projets critiques qui nous font confiance.</h2>
  </header>
  <ul>
    {references.map((reference) => <li>{reference}</li>)}
  </ul>
</section>
```

- [ ] **Step 3: Add responsive brand styling**

Style a full-width ruled band using the existing tokens. Use a four-column list on wide screens, two columns below the tablet breakpoint, and one column at 320 px. Keep organization names as text, with no card backgrounds, rounded containers, shadows, or animation.

- [ ] **Step 4: Run the source contract and verify GREEN**

Run: `npm run review:source`

Expected: PASS with `Static source contract is complete.`

- [ ] **Step 5: Run full verification**

Run: `npm run check`

Expected: zero Astro errors, warnings, or hints.

Run: `npm run build`

Expected: static build succeeds and production/site contracts pass.

Run: `npm run qa:static`

Expected: desktop, tablet, 390 px, and 320 px views have zero overflow and zero browser errors.

- [ ] **Step 6: Review the rendered section and run the design detector**

Inspect the desktop and mobile screenshots in `qa/artifacts/static/`. Then run:

```bash
node /Users/amine/.codex/skills/impeccable/scripts/detect.mjs --json \
  src/pages/index.astro src/styles/global.css
```

Expected: no new design-rule violations.

- [ ] **Step 7: Commit the implementation**

```bash
git add scripts/review-static-source.mjs src/data/site.ts src/pages/index.astro src/styles/global.css
git commit -m "feat: add client references section"
```
