# Objectif Fige - Asset Library First

## Objectif Canonique

Construire une carte jouable premium pour IT Art Studio en partant d'abord d'une
bibliotheque d'assets GLB/glTF et de textures web-ready, puis agrandir le monde
a partir de ce vocabulaire visuel, composer trois hero locations memorables et
valider chaque iteration par une QA visuelle jouee au clavier.

La reference de qualite reste l'esprit Bruno Simon: un monde web jouable,
lisible, curieux, ou le contenu devient un lieu a explorer. L'objectif n'est pas
de copier son univers, son vehicule ou ses assets, mais d'atteindre le meme
niveau d'exigence percue: assets propres, carte respirante, lieux
reconnaissables, interactions fiables et captures QA capables de juger le
livrable comme une vraie experience.

## Plan Fige

Le plan de production est maintenant verrouille dans cet ordre:

1. Collecter et curer un maximum d'assets et textures accelerateurs.
2. Stabiliser le pipeline GLB/glTF et textures.
3. Agrandir une map volontairement peu dense, mais coherentement preparee.
4. Construire trois hero locations premium avec la bibliotheque d'assets.
5. Reduire le bruit procedural et les doublons visuels.
6. Iterer en boucle QA jusqu'a obtenir des captures comparables a un livrable
   vitrine premium.

Ce plan remplace l'approche "agrandir d'abord puis habiller ensuite".
L'ordre est volontaire: la bibliotheque cree le langage visuel, la map s'etend
avec ce langage, puis les lieux deviennent memorables.

## Priorite Figee

- Bibliotheque assets et textures: 30%;
- Pipeline GLB/glTF: 20%;
- Agrandissement map et terrain: 25%;
- Hero locations: 20%;
- Gameplay vehicule: 5%.

Le vehicule reste un moyen d'exploration. Il doit etre agreable et credible,
mais il ne doit pas consommer l'effort principal tant que la carte, les assets,
les textures, l'eau, le relief et les lieux signatures ne portent pas encore le
waou visuel.

## Contrat De Boucle Agentic

Chaque boucle doit livrer une progression concrete sur au moins un des axes
suivants:

- la quantite et la qualite des assets utilisables en production;
- la coherence du terrain, des routes, de la verdure, de l'eau et du relief;
- la lisibilite des trois lieux signatures;
- la reduction du bruit procedural;
- la capacite de la QA a prouver visuellement que le site devient un monde
  exploratoire premium.

Une boucle ne doit pas ajouter du volume pour donner l'impression d'avancer.
Elle doit remplacer de l'abstrait par du concret: un asset accepte, une texture
verifiee, une zone mieux lisible, une capture QA plus probante, ou du bruit
supprime.

## Ordre Operationnel

1. Collecter et curer la bibliotheque d'assets et textures.
2. Stabiliser le pipeline GLB/glTF.
3. Agrandir une map vide mais coherente.
4. Composer les trois hero locations.
5. Reduire le bruit procedural.
6. Iterer avec une QA visuelle et performance.

## Definition De Succes Du Prochain Jalon

Le prochain jalon est considere reussi seulement si:

- les assets runtime ont une source, une licence, un role narratif, un poids et
  un fallback documentes;
- les textures route, vegetation, eau et relief sont disponibles en runtime et
  verifiees par le manifest;
- la map agrandie garde des routes, respirations, berges, reliefs et zones de
  transition coherents;
- `Cloud Dock`, `Design Atelier` et `Observability Tower` sont reconnaissables
  en screenshot sans lire les panneaux HTML;
- les captures QA desktop prouvent le chargement, l'exploration clavier,
  l'absence de scintillement evident, la presence d'eau, de relief, de verdure
  et d'assets 3D;
- les proceduraux generiques diminuent a chaque vague ou restent uniquement
  comme fallback, FX ou structure temporaire assumee.

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

Baseline actuelle:

- sources curation: Kenney, Poly Haven, ambientCG, Quaternius, Khronos, texture
  kit local IT Art Studio;
- modeles runtime acceptes: routes, route-edge, ponts, eau, relief,
  vegetation;
- textures runtime acceptees: route, field/vegetation, eau, relief;
- chaque fichier runtime doit rester declare dans le manifest et passer
  `npm run assets:validate`.

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

La phase texture suit le meme principe: source, licence, chemin public
GitHub Pages-safe, poids, role terrain, fallback et fichier runtime declare.

## Phase 3 - Map Agrandie

Agrandir la carte apres avoir constitue le vocabulaire visuel, pas avant.

Principes:

- poser un terrain plus vaste et lisible avec respirations;
- definir routes, chemins, eau, relief et vegetation comme langage de level
  design;
- eviter les murs invisibles: le decor guide, il ne bloque pas gratuitement;
- construire des silhouettes lointaines et des points de repere;
- laisser des zones vides assumees pour donner de l'echelle.

Baseline actuelle:

- monde jouable: `68x68`;
- roam QA interieur: `+-29.4`;
- terrain: features physiques reparties au centre, en peripherie et sur les
  nouvelles terrasses nord/est/ouest;
- eau: huit regions, dont plusieurs respirations de bord;
- rampes: dix transitions, sans collision bloquante;
- GLB opt-in `?assets=map`: couverture attendue au moins `56x56`.

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
Les priorites de production sont fixees dans la section `Priorite Figee`.
Toute boucle qui propose de travailler sur le gameplay vehicule doit expliquer
pourquoi cela debloque directement la qualite de la carte ou de la QA visuelle.

## Non-Objectifs De Cette Boucle

- refaire toute la conduite avant d'avoir une meilleure map;
- modeliser tous les assets a la main si une bibliotheque fiable existe;
- agrandir la map avec des proceduraux generiques;
- ajouter dix zones detaillees avant que trois lieux soient premium;
- pousser l'effet waou avec du bruit visuel.
