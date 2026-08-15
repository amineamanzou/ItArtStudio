# Scroll Reveals and Ambient Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire entrer chaque contenu depuis sa moitié au scroll, simplifier les références, décaler les étapes de méthode et enrichir méthode/contact avec une lumière de marque.

**Architecture:** Le contrôleur `section-reveals.ts` reste l'unique observateur. Le HTML décrit le côté avec `data-reveal="split-left"` ou `data-reveal="split-right"`; le CSS compose translation, opacité et, pour les logos, masque/focus. La QA Playwright mesure le comportement rendu plutôt que la seule présence de classes.

**Tech Stack:** Astro, TypeScript, CSS OKLCH, IntersectionObserver, Playwright, Node assertions.

## Global Constraints

- L'axe vertical central reste continu et au-dessus des halos.
- Aucun séparateur horizontal ne traverse l'axe.
- Les contenus ART entrent depuis la gauche ; les contenus IT depuis la droite.
- `prefers-reduced-motion` affiche tout sans mouvement.
- Le dossier non suivi `media/` reste intact.

---

### Task 1: Contrats de contenu et de géométrie

**Files:**
- Modify: `scripts/review-static-source.mjs`
- Modify: `scripts/review-static-site.mjs`
- Modify: `scripts/qa-static.mjs`

**Interfaces:**
- Consumes: HTML statique et page rendue.
- Produces: assertions sur références, côtés, rangées et révélations.

- [ ] **Step 1: Écrire le contrat en échec**

Ajouter des assertions qui refusent le titre visible de références, Axxès et Ylio ; exigent les attributs `split-left` et `split-right` sur les contenus ; mesurent que Produire commence sous le bas de Cadrer ; vérifient qu'un logo gauche et un logo droit sont initialement décalés puis révélés après scroll.

- [ ] **Step 2: Vérifier l'échec attendu**

Run: `npm run review:source`

Expected: FAIL sur l'ancien header Références ou les références Axxès/Ylio.

- [ ] **Step 3: Conserver les attentes indépendantes**

Les valeurs attendues sont des littéraux issus de la demande, et la QA navigateur lit les rectangles et styles calculés réels.

---

### Task 2: Structure et données

**Files:**
- Modify: `src/data/site.ts`
- Modify: `src/pages/index.astro`
- Delete: `public/assets/references/axxes.png`
- Delete: `public/assets/references/ylio.svg`

**Interfaces:**
- Consumes: `references`, `methodSteps`, `company`.
- Produces: structure sémantique sans introduction visible et attributs latéraux.

- [ ] **Step 1: Retirer les références demandées**

Supprimer Axxès et Ylio des données et retirer leurs deux fichiers locaux.

- [ ] **Step 2: Simplifier la section références**

Remplacer le header visible par `<h2 class="visually-hidden">Références ART et IT</h2>`. Attribuer aux titres de colonnes et logos le côté de leur pratique.

- [ ] **Step 3: Décrire toutes les entrées latérales**

Conserver les prestations existantes, puis ajouter les attributs gauche/droite aux fragments de titre méthode, aux trois étapes et aux deux contacts. Ajouter `data-reveal-kind="logo"` aux logos pour leur traitement supplémentaire.

---

### Task 3: Mouvement, rangées et lumière

**Files:**
- Modify: `src/styles/global.css`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: `data-reveal="split-left|split-right"`, `data-reveal-kind="logo"`, `is-revealed`.
- Produces: mouvement latéral, masque de logo, grille de méthode et halos.

- [ ] **Step 1: Unifier les entrées latérales**

Appliquer une translation initiale de `-5.5rem` à gauche et `5.5rem` à droite, avec opacité nulle et transition de 750 à 850 ms. `is-revealed` ramène chaque élément à zéro.

- [ ] **Step 2: Donner une signature aux logos**

Ajouter au mouvement latéral un `clip-path`, un `blur(8px)` et un léger `scale(.96)`, avec stagger plafonné sous 500 ms.

- [ ] **Step 3: Décaler la méthode**

Fixer Cadrer en rangée 1 colonne 1, Produire en rangée 2 colonne 2 et Transmettre en rangée 3 colonne 1. Maintenir des espacements verticaux lisibles.

- [ ] **Step 4: Ajouter les halos bornés**

Positionner quatre pseudo-éléments diffus derrière méthode/contact : corail à gauche et cyan à droite. Utiliser une chute radiale bornée sans filtre de flou coûteux et `isolation: isolate`; garder le texte au-dessus et l'axe central visible.

- [ ] **Step 5: Préserver l'accessibilité**

Neutraliser translation, filtre, masque et transition sous `prefers-reduced-motion: reduce`.

---

### Task 4: Vérification et commit local

**Files:**
- Modify as needed: `scripts/qa-static.mjs`, `src/styles/global.css`

**Interfaces:**
- Consumes: build final.
- Produces: captures et commit local vérifiés.

- [ ] **Step 1: Passer les contrats**

Run: `npm run review:source && npm run check && npm run build`

Expected: 0 erreur, contrat statique complet.

- [ ] **Step 2: Vérifier le scroll réel**

Run: `npm run qa:static`

Expected: mouvements gauche/droite, logos révélés, Produire sous Cadrer, aucun débordement ni erreur navigateur.

- [ ] **Step 3: Inspecter desktop et tablette**

Vérifier les captures de l'accueil, la lisibilité des halos et la continuité de l'axe.

- [ ] **Step 4: Contrôler et commiter**

Run: `node /Users/amine/.codex/skills/impeccable/scripts/detect.mjs --json src/pages/index.astro src/styles/global.css && git diff --check`

Stage uniquement les fichiers de cette passe, puis créer un commit local sans toucher à `media/`.
