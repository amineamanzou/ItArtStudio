# Design

## Visual Theme

IT Art Studio adopte une direction ludique: une agence tech creative presentee
comme une carte de jeu video miniature. Le visiteur ne scrolle plus une
sequence cinematic; il arrive directement dans un monde jouable ou chaque
activite du studio devient un lieu a explorer.

La reference assumee est `https://bruno-simon.com/`, mais l'intention n'est pas
de copier son vehicule, sa physique ou son univers. On reprend la logique
"contenu = lieu", la carte, les zones interactives et la memoire du geste.

## Color

La palette devient plus lisible et plus jouable:

- `--ink`: texte principal sur fond sombre.
- `--field`: vert-noir de carte miniature.
- `--tech`: cyan electrique pour les zones IT.
- `--art`: corail/rose pour les zones ART.
- `--studio`: jaune chaud pour le centre commun.
- `--panel`: surface de panneau lisible, non glass par defaut.

Les couleurs servent a comprendre la topologie: IT, ART et STUDIO doivent etre
identifiables sans imposer un split strict.

## Typography

La V2 evite l'esthetique editorial-serieuse. Le ton devient plus joueur, mais
reste precis:

- UI et corps: pile systeme rapide.
- Titres: graisse forte, formes nettes, pas de serif editorial.
- Labels de carte: courts, lisibles et fonctionnels.

## Layout

La home est une interface de jeu:

1. Canvas 3D full viewport.
2. HUD minimal: marque, statut de zone, action contact.
3. Mini-map cliquable.
4. Panneau HTML de zone, accessible et indexable.
5. Controle mobile simplifie.
6. Fallback HTML si WebGL ou JavaScript est indisponible.

Le site doit s'utiliser comme une carte. Le scroll devient secondaire.

## Cartography

Zones V1:

- Studio Gate: entree et promesse.
- AI Lab: innovation IA et prototypes.
- Observability Tower: diagnostic, traces, logs, metriques.
- Architecture Bridge: arbitrages systeme et design technique.
- Cloud Dock: scaling, delivery, infrastructure.
- Design Atelier: direction creative, image, marque.
- 3D Foundry: volumes, objets, modelisation.
- Fashion Room: collection, matiere, desirabilite.
- Values Plaza: exigence, clarte, audace, transmission.
- Contact Portal: prise de contact.

La V1.2 ajoute une couche de topographie lisible:

- districts translucides IT, ART et STUDIO pour orienter le regard;
- corridors lumineux courbes entre le Studio Gate et chaque activite;
- noeuds de route et balises verticales pour donner de l'echelle;
- anneaux de zone pour renforcer le feedback de presence.

## Motion

La motion vient du gameplay, pas du scroll:

- Deplacement clavier sur desktop.
- Deplacement via boutons/mini-map sur mobile.
- Camera isometrique qui suit le joueur.
- Mise en lumiere de la zone active.
- Animation douce des objets de carte.

`prefers-reduced-motion` conserve la carte et limite les mouvements decoratifs.

## Landmarks

La V1.1 utilise des assets proceduraux Three.js, un landmark distinct par zone:

- `Studio Gate`: portique commun IT / ART.
- `AI Lab`: nodes et ecran de prototype.
- `Observability Tower`: tour radar et anneaux de signal.
- `Architecture Bridge`: pont/truss structurel.
- `Cloud Dock`: dock et nuage soutenu.
- `Design Atelier`: chevalet, toile et pastilles couleur.
- `3D Foundry`: potence et forme suspendue.
- `Fashion Room`: mannequin stylise.
- `Values Plaza`: piliers et anneau commun.
- `Contact Portal`: portail et enveloppe.

Ces landmarks restent legers et generes en code avant de passer a des GLB. Un
asset futur doit avoir un role narratif clair, un fallback procedural et un
budget compresse maitrise.

## Architecture

Le moteur V1 reste volontairement simple:

- Astro pour le shell, SEO, GitHub Pages.
- Three.js pour la carte.
- Deplacement kinematique sans Rapier.
- Zones declaratives dans `src/game/zones.ts`.
- Specs visuelles declaratives dans `src/game/visual-specs.ts`.
- Rendu des specs dans `src/game/zone-visual-renderer.ts`.
- Landmarks proceduraux dans `src/game/procedural-assets.ts`.
- UI HTML synchronisee depuis le moteur.
- Pas d'asset 3D lourd avant validation par QA.

## QA

La QA interactive est un livrable du systeme. `npm run qa:game` lance Astro,
pilote Chromium via Playwright, attend le rendu WebGL, joue plusieurs zones au
clavier, capture desktop/mobile et ecrit un rapport dans `qa/artifacts/`.

Gates V1.1:

- canvas non vide;
- route clavier vers `ai-lab`, `observability-tower`, `design-atelier`,
  `contact-portal`;
- CTA contact actif;
- mobile sans overlap HUD / panel / controles.

Gates V1.2:

- richesse du monde 3D minimale exposee dans `window.__IT_ART_STUDIO_QA__`;
- mini-map sur les 10 zones;
- responsive desktop, tablet, mobile et reduced-motion sans overlap ni texte
  coupe.

Gates V1.3:

- inventaire 3D par zone: mesh count, landmark objects, label et dimensions;
- personnalite du vehicule: nombre de pieces, roues et volume minimal;
- detail visuel de chaque capture: ratio de pixels visibles, transitions et
  buckets couleur;
- telemetrie de frame exposee avant les scenarios de gameplay;
- rapport Markdown enrichi avec zone active, frame time, canvas et inventaire
  3D.

Gates V1.4:

- `ZoneVisualSpec` declaratif pour chaque lieu: biome, decals, prop clusters et
  variantes de materiaux;
- preuve QA tiree du scene graph rendu: specs materialisees, decals visibles,
  clusters de props, objets de props et fingerprints distincts par zone;
- refus des zones qui partagent la meme empreinte visuelle ou qui n'exposent
  que le landmark central.

Gates V1.5:

- animation hints par biome (`idleSpin`, `activeSpin`, `activeScale`, `pulse`);
- roles de mouvement tagges sur decals, clusters et props;
- verification QA du nombre de roles animes pour eviter un monde statique.

## Components

- `game-site`: surface principale.
- `studio-game`: canvas + HUD + panels.
- `world-map`: mini-map.
- `zone-panel`: contenu de la zone active.
- `mobile-drive`: controles tactiles.
- `fallback-zone-list`: contenu lisible sans WebGL.
