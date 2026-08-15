# Services, références, méthode et contact — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplifier l'après-hero autour de l'axe ART / IT, introduire des prestations latérales, des références en logos, une méthode alternée et un double contact.

**Architecture:** La page Astro conserve une source de données unique dans `src/data/site.ts`. Un petit contrôleur `IntersectionObserver` ajoute des états de révélation progressifs sans rendre le contenu dépendant de JavaScript. Les logos sont servis localement depuis `public/assets/references/`.

**Tech Stack:** Astro, TypeScript, CSS natif, IntersectionObserver, scripts de contrat Node, Playwright pour la QA statique.

## Global Constraints

- L'axe vertical ART gauche / IT droite reste continu sur desktop et tablette.
- Aucun trait horizontal de la page d'accueil ne traverse l'axe central.
- Le fond reste noir, ART corail, IT cyan et STUDIO ivoire.
- Le mouvement respecte `prefers-reduced-motion` et ne masque jamais le contenu sans JavaScript.
- Le dossier non suivi `media/` reste hors des commits.

---

### Task 1: Verrouiller le nouveau contrat de page

**Files:**
- Modify: `scripts/review-static-source.mjs`
- Modify: `scripts/review-static-site.mjs`

**Interfaces:**
- Consumes: HTML source Astro et bundle statique généré.
- Produces: assertions sur la structure, les contacts, les références et les animations.

- [ ] **Step 1: Écrire les assertions qui doivent échouer**

Ajouter les attentes suivantes : absence de `activity-section`, de `section-heading` et de `site-nav`; présence de `carine@itart.studio`; présence de HWE, Léo Urban et Aminespired; présence de `data-reveal="service-art"`, `data-reveal="service-it"`, `data-reveal="reference"`; ordre alterné `method-step--left`, `method-step--right`, `method-step--left`; absence de bordure traversante sur les sections de l'accueil.

- [ ] **Step 2: Vérifier l'échec attendu**

Run: `npm run review:source`
Expected: FAIL parce que l'ancienne structure est encore présente.

- [ ] **Step 3: Ne modifier les assertions que pour corriger une erreur de contrat**

Conserver les formulations demandées par Amine ; ne pas adapter les tests à l'ancienne page.

---

### Task 2: Ajouter les références et contacts aux données

**Files:**
- Modify: `src/data/site.ts`
- Create: `public/assets/references/hwe.webp`
- Create: `public/assets/references/leo-urban.webp`
- Create: `public/assets/references/aminespired.webp`
- Create: `public/assets/references/biomerieux.*`
- Create: `public/assets/references/axxes.*`
- Create: `public/assets/references/gca.*`
- Create: `public/assets/references/keyia.*`
- Create: `public/assets/references/enedis.*`
- Create: `public/assets/references/ylio.*`
- Create: `public/assets/references/odigo.*`

**Interfaces:**
- Consumes: ressources locales Aminespired/HWE et marques publiques officielles.
- Produces: `references.art` et `references.it` sous forme `{ name, logo }`, ainsi que `company.artEmail` et `company.itEmail`.

- [ ] **Step 1: Rassembler uniquement des ressources vérifiables**

Réutiliser le sceau Aminespired et l'image HWE présents dans `/Users/amine/Projects/aminespired`, récupérer la marque de la chaîne officielle `youtube.com/@LeoUrban`, puis préférer les sites officiels ou les ressources locales existantes pour les références IT.

- [ ] **Step 2: Normaliser les fichiers**

Convertir les bitmaps en WebP de taille raisonnable, préserver les SVG valides et éviter toute dépendance à un CDN au runtime.

- [ ] **Step 3: Structurer les données**

Chaque référence expose un nom accessible et un chemin local. Ajouter `artEmail: "carine@itart.studio"` et conserver `email: "amine@itart.studio"` comme contact IT/légal principal.

---

### Task 3: Recomposer le HTML et le contrôleur de révélation

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Create: `src/scripts/section-reveals.ts`

**Interfaces:**
- Consumes: `services`, `methodSteps`, `references`, `company`.
- Produces: attributs `data-reveal`, classe `is-revealed`, structure alternée et logos accessibles.

- [ ] **Step 1: Supprimer les blocs redondants et le menu**

Retirer `activity-section`, `section-heading` et la navigation principale du layout. Garder le logo et le lien « Écrire au studio ».

- [ ] **Step 2: Construire la section prestations minimale**

Rendre directement les listes ART et IT dans leurs moitiés. Utiliser un `h2` visuellement masqué pour nommer la section et attribuer `data-reveal="service-art"` ou `data-reveal="service-it"` à chaque prestation.

- [ ] **Step 3: Construire la grille de logos**

Rendre chaque référence dans un `<li data-reveal="reference">` avec `<img alt="Logo …">` et une légende de secours visible.

- [ ] **Step 4: Construire la méthode alternée**

Scinder le titre en deux `span`, puis attribuer les classes gauche/droite selon l'index des étapes.

- [ ] **Step 5: Construire le double contact**

Rendre « Besoin de notre art ? » avec `mailto:carine@itart.studio` à gauche et « Besoin de notre tech ? » avec `mailto:amine@itart.studio` à droite.

- [ ] **Step 6: Ajouter un contrôleur progressif**

Le contrôleur ajoute `has-reveal-motion` à `<html>`, observe les nœuds `[data-reveal]`, applique `is-revealed` une fois visibles puis les désobserve. Si `IntersectionObserver` est indisponible, tous les nœuds reçoivent immédiatement `is-revealed`.

---

### Task 4: Mettre en scène les mouvements et supprimer les coupures

**Files:**
- Modify: `src/styles/global.css`
- Modify: `DESIGN.md`
- Modify: `PRODUCT.md`

**Interfaces:**
- Consumes: classes et attributs de Task 3.
- Produces: composition desktop/tablette, transitions réduites et fallback mobile.

- [ ] **Step 1: Supprimer les bordures horizontales traversantes**

Retirer les bordures du header, des grandes sections, des grilles globales, du contact et du footer. Les séparateurs internes restent confinés dans une moitié avec un retrait avant l'axe.

- [ ] **Step 2: Animer les prestations**

Sous `.has-reveal-motion`, commencer ART avec `translateX(-4rem)` et IT avec `translateX(4rem)`, puis revenir à zéro avec opacité complète et délai indexé.

- [ ] **Step 3: Animer les logos différemment**

Utiliser `clip-path: inset(100% 0 0)`, un léger `scale(.94)` et `filter: blur(8px)`, puis révéler verticalement sans translation latérale.

- [ ] **Step 4: Composer méthode et contact**

Positionner les fragments du titre sur leurs moitiés, aligner Cadrer/Transmettre à gauche et Produire à droite, puis donner aux deux contacts le même poids et leur accent de pratique.

- [ ] **Step 5: Respecter le mouvement réduit**

Dans `@media (prefers-reduced-motion: reduce)`, neutraliser transitions, transformations, masques et filtres.

- [ ] **Step 6: Actualiser la documentation produit**

Documenter les deux contacts et la nouvelle chorégraphie sans modifier la direction mobile différée.

---

### Task 5: Vérifier, ajuster et commiter

**Files:**
- Modify as needed: `src/pages/index.astro`, `src/styles/global.css`, `scripts/review-static-source.mjs`, `scripts/review-static-site.mjs`

**Interfaces:**
- Consumes: page complète.
- Produces: build statique validé et commit local isolé.

- [ ] **Step 1: Vérifier le contrat source**

Run: `npm run review:source`
Expected: PASS.

- [ ] **Step 2: Vérifier typage et build**

Run: `npm run check && npm run build`
Expected: 0 erreur, 0 avertissement, bundle statique valide.

- [ ] **Step 3: Vérifier visuellement**

Run: `npm run qa:static`
Expected: cinq captures, aucun débordement, aucune erreur navigateur. Inspecter au minimum desktop et tablette pour confirmer que l'axe n'est jamais coupé.

- [ ] **Step 4: Contrôler le diff**

Run: `node /Users/amine/.codex/skills/impeccable/scripts/detect.mjs --json src/pages/index.astro src/layouts/BaseLayout.astro src/styles/global.css && git diff --check`
Expected: aucun anti-pattern et aucune erreur d'espacement.

- [ ] **Step 5: Commiter sans le dossier média non suivi**

Stage uniquement les fichiers du plan et créer un commit local `refactor: choreograph split page sections`.
