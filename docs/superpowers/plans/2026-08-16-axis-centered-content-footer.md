# Axis-Centered Content and Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rapprocher tous les contenus textuels desktop de l'axe central et prolonger la lumière du contact dans un footer simplifié avec le vrai logo composé.

**Architecture:** Les conteneurs de moitié restent full-bleed mais leurs enfants textuels utilisent une largeur maximale commune et `justify-self` ou `margin-inline` pour s'ancrer vers l'axe. Le footer réutilise les classes du logo split de la hero et reste transparent sous les halos débordants du contact. Les règles sont neutralisées dans le breakpoint mobile existant.

**Tech Stack:** Astro, CSS Grid, CSS OKLCH, Playwright, Node assertions.

## Global Constraints

- Les fonds, couleurs et halos restent pleine largeur.
- Aucun texte desktop ne doit être abandonné au bord extérieur de sa moitié.
- ART reste à gauche et IT reste à droite de l'axe.
- Le logo du footer reprend la composition multi-ligne de la hero.
- Le footer ne contient pas `amine@itart.studio`.
- La forme légale reste Société à responsabilité limitée, conforme au Kbis.
- Aucun push, merge ou déploiement n'est inclus dans cette passe locale.

---

### Task 1: Contrats géométriques et footer

**Files:**
- Modify: `scripts/qa-static.mjs`
- Modify: `scripts/review-static-source.mjs`

**Interfaces:**
- Consumes: rectangles calculés à 1920 px, pseudo-éléments du contact et HTML du footer.
- Produces: assertions sur proximité de l'axe, continuité lumineuse et contenu légal.

- [ ] **Step 1: Ajouter les assertions en échec**

Mesurer le bord gauche des prestations ART et des étapes Cadrer/Transmettre,
puis exiger qu'il se trouve dans les 600 px précédant l'axe à 1920 px. Mesurer
les deux fragments du titre méthode et les deux contacts pour exiger un espace
inférieur à 160 px avec l'axe.

- [ ] **Step 2: Vérifier le footer rendu**

Exiger un `.split-signature--footer`, interdire tout `mailto:` dans le footer,
conserver le texte légal et le lien Mentions légales. Vérifier que le contact a
`overflow: visible`, que ses halos dépassent son bas et que le footer est
transparent.

- [ ] **Step 3: Observer l'échec attendu**

Run: `npm run build && npm run qa:static`

Expected: FAIL sur la prestation ou l'étape ART trop éloignée de l'axe, ou sur
l'absence de signature footer multi-ligne.

---

### Task 2: Recentrage des contenus

**Files:**
- Modify: `src/styles/global.css`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: `.practice-services--art|it`, `.method-title__left|right`, `.method-step--left|right`, `.contact-practice--art|it`.
- Produces: largeur intérieure commune et ancrage symétrique près de l'axe.

- [ ] **Step 1: Rapprocher les prestations**

Limiter chaque `.service-list` à `28rem`. Utiliser `margin-left: auto` côté ART
et `margin-right: auto` côté IT afin de placer les deux listes près de l'axe.

- [ ] **Step 2: Recomposer la méthode**

Placer le fragment gauche du titre avec `justify-self: end` et `text-align:
right`, puis le fragment droit avec `justify-self: start` et `text-align: left`.
Limiter chaque étape à `34rem`; ancrer les étapes gauches à droite de leur
colonne et l'étape droite à gauche de la sienne.

- [ ] **Step 3: Recomposer contact et références**

Aligner le titre ART des références vers l'axe. Limiter chaque contact à
`34rem`, placer ART contre le bord droit de sa colonne et IT contre le bord
gauche, avec des alignements textuels vers la couture.

- [ ] **Step 4: Préserver le mobile**

Sous 760 px, remettre les largeurs à `100%`, les marges automatiques à zéro et
les alignements à gauche, afin de garder une lecture sur une colonne.

- [ ] **Step 5: Documenter la règle**

Ajouter à `DESIGN.md` la distinction entre atmosphère full-bleed et contenus
centrés sur l'axe.

---

### Task 3: Footer continu

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `.split-signature` et les trois classes `hero-title__it`, `hero-title__art`, `hero-title__studio`.
- Produces: `.split-signature--footer` et footer sans email.

- [ ] **Step 1: Partager le logo composé**

Ajouter `.split-signature` au `h1` de la hero et utiliser le même balisage dans
le lien d'accueil du footer. Le footer place la signature au centre sur la
première rangée.

- [ ] **Step 2: Simplifier les informations**

Supprimer le lien email du footer. Placer la mention légale à gauche près de
l'axe et le lien Mentions légales à droite près de l'axe.

- [ ] **Step 3: Prolonger la lumière**

Passer `.contact-section` à `overflow: visible`; garder `.site-footer`
transparent et positionné au-dessus du contenu tout en laissant les halos du
contact se peindre derrière lui.

---

### Task 4: Vérification et commit local

**Files:**
- Modify as needed: `scripts/qa-static.mjs`, `src/styles/global.css`

**Interfaces:**
- Consumes: build final, screenshots desktop/tablette/mobile.
- Produces: commit local vérifié et preview actualisé.

- [ ] **Step 1: Passer la suite complète**

Run: `npm run check && npm run build && npm run qa:static`

Expected: 0 erreur, géométrie proche de l'axe, footer sans email, halos continus
et aucun débordement horizontal.

- [ ] **Step 2: Inspecter les captures**

Vérifier au minimum `wide-desktop-home.png`, `tablet-home.png` et
`mobile-home.png`, puis ajuster la largeur intérieure si le rythme est trop
serré ou trop lâche.

- [ ] **Step 3: Auditer et commiter**

Run: `node /Users/amine/.codex/skills/impeccable/scripts/detect.mjs --json src/pages/index.astro src/styles/global.css && git diff --check`

Expected: aucun finding bloquant, puis commit local sur
`codex/hero-responsive-finalization` sans push ni merge.
