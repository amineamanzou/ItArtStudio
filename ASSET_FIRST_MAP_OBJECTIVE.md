# Objectif Asset-First Map

## Intention

IT Art Studio doit devenir une experience web jouable de niveau vitrine premium:
une carte 3D exploratoire qui assume la double identite tech et artistique du
studio. La reference de qualite reste l'esprit Bruno Simon: un monde lisible,
vivant, memorable, ou le contenu devient un lieu a explorer.

Le vehicule est un moyen d'exploration. Le coeur de la prochaine phase est la
qualite de la map, des assets, des textures, du relief, de l'eau et des lieux.

## Objectif Canonique

Construire une bibliotheque GLB/glTF et textures comme socle du monde IT Art
Studio, puis agrandir la carte a partir de ce vocabulaire visuel avant de
composer trois hero locations premium. La boucle doit privilegier la coherence
du terrain, la lisibilite des assets, la qualite des textures et la reduction du
bruit procedural, avec une QA visuelle qui prouve que les lieux sont
reconnaissables sans lire le texte.

## Ordre Fige

1. Collecter et curer la bibliotheque d'assets et textures.
2. Stabiliser le pipeline GLB/glTF.
3. Agrandir une map vide mais coherente.
4. Composer les trois hero locations.
5. Reduire le bruit procedural.
6. Iterer avec une QA visuelle et performance.

## Phase 1 - Bibliotheque Assets Et Textures

Collecter en priorite des assets web-ready, preferablement GLB/glTF, avec
licence claire, poids maitrise et usage narratif explicite.

Families prioritaires:

- routes, chemins, bordures, ponts, plateformes;
- herbe, sols, rochers, falaises, reliefs, vegetation;
- eau, berges, pontons, traverses, materiaux humides;
- serveurs, racks, cables, antennes, ecrans, arcs electriques;
- mannequins, tables de coupe, tissus, portants, outils d'atelier;
- comptoir postal, boites, lettres, tapis de tri, signal contact.

Sources a privilegier:

- Kenney, Quaternius, Poly Pizza, Poly Haven, Khronos sample assets;
- assets CC0 ou licences simples;
- exports Blender uniquement pour les pieces introuvables ou signature.

Critere d'acceptation:

- source et licence documentees;
- asset visible en screenshot QA;
- pas de z-fighting, scintillement ou texture superposee;
- budget poids, mesh, material et draw calls respecte;
- fallback procedural ou degradation controlee.

## Phase 2 - Pipeline GLB/glTF

Le pipeline doit permettre d'importer vite sans salir la scene.

Exigences:

- manifest versionne par asset: source, licence, attribution, poids, role,
  zone cible, fallback et budget;
- normalisation centralisee: scale, rotation, pivot, sol, materiaux;
- distinction claire entre assets `primary`, `support` et `context`;
- verification automatique: fichier chargeable, visible, pas trop lourd, pas
  hors budget;
- telemetrie QA: placements, roles terrain, assets uniques, clearances,
  densite, preuves screen-space.

## Phase 3 - Map Agrandie

Agrandir la carte apres avoir constitue le vocabulaire visuel, pas avant.

Principes:

- poser un terrain plus vaste et lisible avec respirations;
- definir routes, chemins, eau, relief et vegetation comme langage de level
  design;
- eviter les murs invisibles: le decor guide, il ne bloque pas gratuitement;
- construire des silhouettes lointaines et des points de repere;
- laisser des zones vides assumees pour donner de l'echelle.

## Phase 4 - Trois Hero Locations

Composer seulement trois lieux premium au depart, plutot que dix lieux moyens.

Hero locations:

- `Cloud Dock`: serveurs, nuages, pontons, cables, arcs electriques;
- `Design Atelier`: mannequin, table de coupe, tissus, portants, matieres;
- `Observability Tower`: tour, antennes, ecrans, traces, faisceaux.

Definition of done:

- chaque lieu est reconnaissable sans lire le panneau HTML;
- chaque lieu a une silhouette forte en vue eloignee;
- chaque lieu garde un plan clair en vue rapprochee;
- les assets proceduraux generiques sont remplaces ou reduits;
- chaque lieu passe une capture QA dediee.

## Phase 5 - Reduction Du Bruit

Le site doit gagner en qualite par retrait autant que par ajout.

A supprimer ou remplacer:

- objets generiques qui n'aident pas la comprehension;
- petits marqueurs repetitifs;
- superpositions de textures;
- clusters trop denses;
- props qui n'ont pas de role narratif.

## Phase 6 - QA Continue

La QA doit juger le livrable comme une experience visuelle, pas seulement comme
une scene Three.js qui charge.

Le protocole doit prouver:

- temps de chargement passe;
- map parcourable au clavier;
- captures avant/apres par zone;
- lisibilite route/eau/relief/vegetation;
- reconnaissance des trois hero locations sans texte;
- absence de scintillement, z-fighting et assets casses;
- budget renderer et scene graph preserve;
- regression mobile et desktop couverte.

## Priorites De Production

- Bibliotheque assets et textures: 30%;
- Pipeline GLB/glTF: 20%;
- Agrandissement map et terrain: 25%;
- Hero locations: 20%;
- Gameplay vehicule: 5%.

## Non-Objectifs De Cette Boucle

- refaire toute la conduite avant d'avoir une meilleure map;
- modeliser tous les assets a la main si une bibliotheque fiable existe;
- agrandir la map avec des proceduraux generiques;
- ajouter dix zones detaillees avant que trois lieux soient premium;
- pousser l'effet waou avec du bruit visuel.
