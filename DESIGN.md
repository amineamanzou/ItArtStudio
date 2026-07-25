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

## Motion

La motion vient du gameplay, pas du scroll:

- Deplacement clavier sur desktop.
- Deplacement via boutons/mini-map sur mobile.
- Camera isometrique qui suit le joueur.
- Mise en lumiere de la zone active.
- Animation douce des objets de carte.

`prefers-reduced-motion` conserve la carte et limite les mouvements decoratifs.

## Architecture

Le moteur V1 reste volontairement simple:

- Astro pour le shell, SEO, GitHub Pages.
- Three.js pour la carte.
- Deplacement kinematique sans Rapier.
- Zones declaratives dans `src/game/zones.ts`.
- UI HTML synchronisee depuis le moteur.
- Pas d'asset 3D lourd avant validation de la navigation.

## Components

- `game-site`: surface principale.
- `studio-game`: canvas + HUD + panels.
- `world-map`: mini-map.
- `zone-panel`: contenu de la zone active.
- `mobile-drive`: controles tactiles.
- `fallback-zone-list`: contenu lisible sans WebGL.
