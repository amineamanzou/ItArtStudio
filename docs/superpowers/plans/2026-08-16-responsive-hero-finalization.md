# Responsive Hero Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finaliser la hero en supprimant son header redondant, en épinglant son titre après le scrub, en conservant les deux personnes sur chaque largeur et en rendant le reste de la page réellement bord à bord.

**Architecture:** Le contrôleur `hero-scroll.ts` sélectionne un groupe de vidéos selon la largeur, leur applique une position temporelle unique et publie deux variables CSS pour la signature. Le HTML fournit un média large, deux crops synchronisés et un média vertical dédié. Les sections deviennent full-bleed tandis que leur padding interne continue de respecter les deux moitiés.

**Tech Stack:** Astro, TypeScript, CSS, HTMLVideoElement, Playwright, ffmpeg H.264/VP9.

## Global Constraints

- La vidéo validée reste la source temporelle de quatre secondes.
- Carine reste à gauche pour ART et Amine à droite pour IT.
- Le `h1` existant est l'unique signature visible en haut de page.
- L'axe vertical central reste continu et au-dessus des fonds.
- `prefers-reduced-motion` ne masque aucun contenu et ne joue aucune vidéo.
- Aucun push, merge ou déploiement n'est inclus dans cette passe locale.

---

### Task 1: Contrats de rendu responsive

**Files:**
- Modify: `scripts/qa-static.mjs`
- Modify: `scripts/review-static-source.mjs`

**Interfaces:**
- Consumes: HTML construit, CSS calculé, groupes `[data-hero-video-group]`.
- Produces: assertions comportementales sur cadrage, plein écran et signature.

- [ ] **Step 1: Écrire les assertions en échec**

Ajouter une QA qui refuse le header décoratif sur l'accueil, exige des sections
de largeur viewport, vérifie que la signature rejoint le haut à la fin du scrub
et y reste après la hero, puis vérifie le groupe split sur tablette et le média
vertical sur mobile.

- [ ] **Step 2: Vérifier l'échec attendu**

Run: `npm run build && npm run qa:static`

Expected: FAIL sur l'absence de groupes vidéo responsive ou la largeur bornée
des sections.

- [ ] **Step 3: Ajouter le contrat source utile**

Exiger les assets mobiles et le marqueur de signature persistante, sans tester
une formulation CSS privée.

---

### Task 2: Composition vidéo verticale

**Files:**
- Create: `public/assets/hero-scroll-mobile.mp4`
- Create: `public/assets/hero-scroll-mobile.webm`
- Create: `public/assets/hero-scroll-mobile-poster.jpg`
- Create: `media/hero-responsive/project.md`

**Interfaces:**
- Consumes: `public/assets/hero-scroll.mp4` (1920×1080, 4 s, 24 fps).
- Produces: fichiers 720×1280, 4 s, Carine à gauche et Amine à droite.

- [ ] **Step 1: Composer le review 9:16**

Recadrer les deux extrémités de la source, les assembler côte à côte et encoder
une version H.264 720×1280 à 24 fps.

- [ ] **Step 2: Produire les fallbacks web**

Encoder le même flux en VP9/WebM et extraire un poster JPEG depuis la dernière
image utile.

- [ ] **Step 3: Vérifier les médias**

Run: `ffprobe` sur les deux vidéos.

Expected: 720×1280, durée 4.000 s, aucun flux audio requis.

---

### Task 3: Structure et contrôleur de hero

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/scripts/hero-scroll.ts`

**Interfaces:**
- Consumes: `[data-hero-video-group="wide|split|mobile"]`, `[data-hero-signature]`.
- Produces: groupe actif synchronisé, `--hero-progress`, `--signature-y`, `--signature-scale`.

- [ ] **Step 1: Retirer le header redondant**

Supprimer le header de `BaseLayout.astro` tout en conservant le skip-link, le
footer et l'unique `h1` de l'accueil.

- [ ] **Step 2: Décrire les trois cadrages**

Ajouter le média large, deux panneaux split partageant les sources desktop, et
le média mobile 9:16. Chaque vidéo reste `muted`, `playsinline`, en pause et
hors de l'arbre accessible.

- [ ] **Step 3: Piloter uniquement le groupe actif**

Résoudre le groupe actif par `matchMedia`, attendre ses métadonnées, mettre à
jour toutes ses vidéos avec la même cible temporelle et recalculer au resize.

- [ ] **Step 4: Épingler la signature**

Interpoler transform et échelle entre 80 et 100 % du scrub, puis conserver la
position compacte pendant tout le reste de la page. En mouvement réduit,
appliquer directement l'état final et la dernière frame.

---

### Task 4: Full-bleed et cadrages CSS

**Files:**
- Modify: `src/styles/global.css`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: classes de groupes vidéo et variables de signature.
- Produces: visibilité exclusive par breakpoint, full-bleed et halos non coupés.

- [ ] **Step 1: Rendre les sections bord à bord**

Retirer `var(--max)` des sections de l'accueil et du footer. Garder une largeur
bornée uniquement sur la page légale si nécessaire.

- [ ] **Step 2: Définir les cadrages**

Afficher le plein cadre au-dessus de 1100 px, les deux panneaux de 761 à 1100
px avec un crop centré sur chaque personne, et la composition verticale jusqu'à
760 px.

- [ ] **Step 3: Transformer le titre**

Fixer la signature au viewport, appliquer `--signature-y` et
`--signature-scale` par transform et assurer sa lisibilité compacte au-dessus
des sections.

- [ ] **Step 4: Corriger les halos**

Ancrer les pseudo-éléments aux bords des sections désormais full-bleed et
conserver leur chute radiale derrière le contenu.

- [ ] **Step 5: Documenter la nouvelle règle**

Mettre à jour `DESIGN.md` avec les trois cadrages et la signature persistante.

---

### Task 5: Vérification et revue locale

**Files:**
- Modify as needed: `scripts/qa-static.mjs`, `src/styles/global.css`, `src/scripts/hero-scroll.ts`

**Interfaces:**
- Consumes: build complet et captures Playwright.
- Produces: branche locale vérifiée et URL de review.

- [ ] **Step 1: Passer les contrats**

Run: `npm run check && npm run build && npm run qa:static`

Expected: 0 erreur, médias décodés, aucun débordement, toutes les assertions
responsive et mouvement réduit au vert.

- [ ] **Step 2: Inspecter les captures**

Vérifier grand desktop, tablette, mobile, début et fin de scrub, puis ajuster le
cadrage au maximum trois fois.

- [ ] **Step 3: Auditer le frontend**

Run: `node /Users/amine/.codex/skills/impeccable/scripts/detect.mjs --json src/pages/index.astro src/styles/global.css && git diff --check`

Expected: aucun défaut bloquant ni espace cassé.

- [ ] **Step 4: Commiter localement et monter le preview**

Créer un commit intentionnel sur `codex/hero-responsive-finalization`, démarrer
Astro sur un port local et communiquer l'URL sans pousser ni déployer.
