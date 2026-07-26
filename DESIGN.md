# Design

## Visual Theme

IT Art Studio adopte une direction ludique: une agence tech creative presentee
comme une carte de jeu video miniature. Le visiteur ne scrolle plus une
sequence cinematic; il arrive directement dans un monde jouable ou chaque
activite du studio devient un lieu a explorer.

La reference assumee est `https://bruno-simon.com/`, mais l'intention n'est pas
de copier son vehicule, sa physique ou son univers. On reprend la logique
"contenu = lieu", la carte, les zones interactives et la memoire du geste.

## Target Quality

L'objectif produit est un mini-monde jouable de niveau vitrine premium:

- une carte plus vaste qui donne envie d'explorer, avec relief, rampes, eau et
  surfaces roulables partout;
- une conduite arcade lisible: acceleration, freinage, inertie, drift, braquage
  en mouvement et son moteur reactif;
- aucun mur invisible bloquant l'exploration libre; les decors peuvent guider,
  mais le vehicule doit rester libre sur la carte;
- des assets 3D modeles par lieu, moins nombreux mais plus caracteristiques:
  silhouettes fortes, textures propres, pas de scintillement par superposition;
- chaque activite devient un niveau identifiable: cloud avec serveurs et
  nuages, observabilite avec tour et signaux, design avec atelier vetement,
  contact avec decor postal;
- la QA Playwright doit produire des captures et preuves de gameplay assez
  lisibles pour juger le niveau comme un vrai livrable, pas seulement comme une
  scene Three.js chargee.

## Asset-First Roadmap

La suite du projet adopte une strategie asset-first. Le gameplay vehicule reste
un support d'exploration, pas le centre du produit. Le saut de qualite doit
venir de la carte, des assets, des textures, des silhouettes et de la coherence
des lieux.

Objectif fige:

> Construire une carte jouable premium pour IT Art Studio en partant d'abord
> d'une bibliotheque d'assets GLB/glTF et de textures web-ready, puis agrandir
> le monde a partir de ce vocabulaire visuel, composer trois hero locations
> memorables et valider chaque iteration par une QA visuelle jouee au clavier.

Sequence de livraison:

1. Collecter et curer une bibliotheque d'assets et textures.
   - routes, chemins, bordures, ponts et plateformes;
   - herbe, sols, rochers, falaises, reliefs et vegetation;
   - eau, berges, pontons, traverses et materiaux humides;
   - serveurs, racks, cables, antennes, ecrans et arcs electriques;
   - mannequins, tables de coupe, tissus, portants et outils d'atelier;
   - comptoir postal, boites, lettres, tapis de tri et signal contact.

2. Installer le pipeline GLB/glTF.
   - manifest versionne par asset: licence, source, poids, triangles, textures,
     zone cible, role narratif et fallback procedural;
   - loader centralise, normalisation scale / rotation / materials;
   - budget perf par asset: taille, draw calls, textures, geometries;
   - QA qui refuse un asset casse, trop lourd, sans licence ou non visible.

3. Agrandir une map vide mais coherente.
   - terrain plus vaste avant detail;
   - routes et chemins deja coherents avec la bibliotheque;
   - relief, eau, vegetation et transitions de districts poses comme langage de
     level design;
   - zones plus eloignees, respirations, points de repere et silhouettes
     lointaines.

4. Composer trois hero locations avec la bibliotheque.
   - `Cloud Dock`: racks serveur, nuages, pontons, liaisons electriques;
   - `Design Atelier`: mannequin, table de coupe, tissus, portants, matieres;
   - `Observability Tower`: tour, antennes, ecrans, traces, faisceaux.

5. Reduire le bruit procedural.
   - remplacer les petits marqueurs generiques par des assets narratifs;
   - supprimer tout objet qui n'aide pas la comprehension du lieu ou la
     composition;
   - conserver les proceduraux seulement comme fallback, FX ou detail utile.

6. Iterer avec QA.
   - captures avant/apres par zone;
   - preuve que routes, eau, relief et vegetation restent lisibles;
   - preuve que les trois hero locations se reconnaissent sans texte;
   - preuve d'absence de scintillement, superposition de textures et assets
     casses;
   - budget renderer et scene graph preserves.

Priorite produit:

- Bibliotheque assets / textures: 30%;
- Pipeline GLB/glTF: 20%;
- Agrandissement map / terrain: 25%;
- Hero locations: 20%;
- Gameplay vehicule: 5%.

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

- Deplacement clavier vehicule sur desktop: gauche/droite orientent le rover,
  haut/bas avancent ou reculent dans l'axe du vehicule.
- Conduite arcade: acceleration, freinage, inertie, drift lateral, recuperation
  et braquage seulement quand le vehicule avance ou recule.
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

La prochaine vague d'assets doit remplacer les symboles trop generiques par des
lieux lisibles:

- Cloud Dock: nuages 3D, racks serveur, liaisons electriques visibles.
- Design Atelier: atelier vetement, mannequin, matieres, plan de travail.
- Contact Portal: decor postal, tri courrier, boites et signal de contact.
- Observability Tower: tour conservee, enrichie par antennes, traces et ecrans.

Les imports GLB doivent passer par un manifest versionne avec licence, poids,
role narratif, fallback procedural et budget d'objets. Un asset est accepte
seulement s'il reduit le bruit visuel ou augmente la comprehension du lieu.

## Architecture

Le moteur V1 reste volontairement simple:

- Astro pour le shell, SEO, GitHub Pages.
- Three.js pour la carte.
- Deplacement kinematique sans Rapier.
- Zones declaratives dans `src/game/zones.ts`.
- Specs visuelles declaratives dans `src/game/visual-specs.ts`.
- Rendu des specs dans `src/game/zone-visual-renderer.ts`.
- Set dressing narratif par zone dans `src/game/zone-set-dressing.ts`.
- Landmarks proceduraux dans `src/game/procedural-assets.ts`.
- UI HTML synchronisee depuis le moteur.
- Pas d'asset 3D lourd avant validation par QA.

La V4.6 ajoute une couche de contact au sol partagee par le decor et la
physique:

- `src/game/world-materials.ts` declare les surfaces `road`, `field`, `water`
  et `ramp`;
- les bassins et rampes visibles sont derives des memes regions que les
  coefficients de conduite;
- l'eau ralentit et reduit le grip, les rampes changent le ride height, le
  pitch et le roll du rover;
- les FX de surface sont instancies pour garder le budget `sceneObjects <= 940`.

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

Gates V1.6:

- set dressing procedural par zone: consoles, traces, rails, swatches, runways,
  portails et panneaux lisibles;
- signatures de decor distinctes exposees dans le scene graph;
- verification QA que chaque zone possede plusieurs roles de decor, des
  signatures non dupliquees et un canvas full-screen visible;
- preuve DOM de l'identite `IT / ART / STUDIO` en plus de la preuve pixel.

Gates V1.7:

- comportements locaux par asset (`pulse`, `sweep`, `tilt`, `float`, `blink`)
  pour eviter une carte qui donne seulement l'impression de tourner en bloc;
- trail visible du rover apres une route clavier, expose dans le snapshot QA;
- clics reels sur la mini-map avec hit-test DOM, synchronisation du marqueur,
  `aria-pressed` unique et mode d'input `pointer`;
- nav mobile et pad mobile testes par actions pointeur reelles, pas par
  mutation DOM;
- dev toolbar Astro desactivee pour que les tests de bas d'ecran mesurent la
  surface utilisateur finale.

Gates V1.8:

- scenographie globale du monde: couches de terrain, ledges IT/ART/STUDIO,
  silhouettes tech, sculptures art, seuils studio et lumieres de routes;
- decor global anime separement des zones pour donner une respiration au monde
  entier sans augmenter la rotation du plateau;
- snapshot QA enrichi avec `terrainLayers`, `sceneryObjects`,
  `scenerySignatures`, `sceneryMotionObjects` et `sceneryRoleCounts`;
- rejet QA si la carte redevient un plateau plat ou si les roles de
  scenographie (`terrain-edge`, `tech-skyline`, `art-sculpture`,
  `studio-threshold`, `route-light`) disparaissent.

Gates V1.9:

- feedback d'activation 3D par zone: halo, anneaux, sparks, pulse du landmark
  et impulsion camera legere;
- snapshot QA enrichi avec `activeFeedback.sequence`, `visibleObjects`,
  `ringCount`, `sparkCount`, `maxOpacity`, `maxScale` et `cameraImpulse`;
- verification Playwright apres route clavier et mini-map que le monde repond
  au changement de lieu, pas seulement le panneau HTML;
- hors rayon de zone, conservation de la derniere zone active pour eviter le
  flicker narratif vers `studio-gate` pendant les traversees.

Gates V4.6:

- `real-drive-arcade-keyboard`: bande d'inputs clavier fixe en `realKeys=1`,
  sans autopilote waypoint, pour prouver acceleration, freinage, virage en
  mouvement, drift, coast/drag, camera stable et absence de jump;
- `real-drive-free-roam`: exploration libre hors route avec distance, span,
  ratio off-route et absence de blocage invisible;
- `surface-material-physics`: preuve separee pour eau et rampes avec samples,
  transitions de materiaux, intensite eau, lift rampe et FX de surface;
- les routes assistees restent utiles pour diagnostiquer la cartographie, mais
  ne sont plus la preuve principale de conduite arcade.

Gates V2.0:

- mode QA `?qa=1&realKeys=1`: snapshot actif, mais hook
  `window.__IT_ART_STUDIO_QA_STEP__` absent pour prouver une vraie conduite;
- tour clavier reel via `keyboard.down/up` sur `ai-lab`,
  `observability-tower`, `design-atelier` et `contact-portal`;
- telemetrie de conduite exposee dans `drive`: distance totale, samples de
  position, vitesse moyenne, rotation cumulee, distance camera, vitesse
  avant/laterale, angle de drift, acceleration et samples hors route;
- telemetrie d'input exposee dans `input`: touches actives, compteurs
  `keydown`/`keyup`, dernier code clavier et appels au hook deterministe;
- rejet QA si la route ressemble a un teleport, si le rover tourne sur place
  comme comportement principal, si le drift n'est pas mesurable, si la distance
  est insuffisante, si un saut d'echantillon est trop grand, si le trail est trop
  faible ou si la camera sort du budget.

Gates V2.1:

- telemetrie camera enrichie: position, cible, position desiree, lag et distance
  au joueur;
- projection screen-space du rover et de la zone active dans le snapshot QA;
- verification Playwright que le joueur reste dans le viewport pendant la
  conduite et que chaque zone atteinte reste lisible aux checkpoints stabilises,
  hors HUD, panneau, mini-map et controles mobiles visibles;
- rejet QA si la conduite reste techniquement possible mais devient illisible
  par occlusion UI, cadrage trop serre ou camera qui ne suit pas assez vite.

Gates V2.2:

- nouvelle couche `signature artifacts`: objets proceduraux sculpturaux par
  zone, separes des landmarks et du set dressing;
- chaque zone expose des signatures, roles, variantes matiere et fingerprints
  dedies pour prouver une silhouette reconnaissable;
- verification QA que les artefacts signature sont presents sur les 10 zones,
  non dupliques et suffisamment varies pour porter la memoire visuelle du lieu;
- rejet QA si une zone revient a un simple socle avec decor generique, meme si
  les anciens compteurs de richesse restent au vert.

Gates V2.3:

- projection screen-space des artefacts signature actifs via bounding box
  Three.js avec rect brut, rect clippe, ratio visible et profondeur;
- verification Playwright que l'artefact signature de la zone active est visible,
  assez grand et non masque par le HUD, le panneau, la mini-map ou les controles;
- preuve pixel locale dans le rect clippe: ratio lumineux, transitions de contour
  et buckets de couleur, pour eviter qu'une simple bbox valide un rendu illisible;
- preuve aux checkpoints du vrai tour clavier, pour eviter une carte dense mais
  illisible pendant l'exploration.

Gates V2.4:

- extension du gate `signature-artifact-visible` aux sauts mini-map, avec les
  10 zones couvertes en profil full;
- rapport QA distinct pour les preuves mini-map afin de verifier toute la
  cartographie et pas seulement le trajet clavier principal;
- runtime public sans snapshot QA lourd: `window.__IT_ART_STUDIO_QA__`,
  `window.__IT_ART_STUDIO_QA_STEP__` et `window.__IT_ART_STUDIO_QA_REFRESH__`
  restent reserves aux URLs `?qa=1`;
- rejet QA si la production n'atteint pas `game-ready` sans exposer les hooks de
  test ou si le canvas cesse d'animer.

Gates V2.5:

- surface de conduite derivee des routes visuelles `worldRoutes`, avec disques
  de liberte autour des zones;
- absence de magnetisme hors route: le rover peut quitter les routes et rouler
  sur la carte sans snap-back ni obstacle invisible, avec seulement la limite
  lisible du monde;
- telemetrie `drive.surface`: samples, ratio d'adherence, distance max hors
  route, routes visitees et largeur de route;
- tour clavier reel par waypoints de graphe, pas seulement par diagonales vers
  les coordonnees de zones;
- rejet QA si la conduite ne couvre pas les routes attendues, reste collee au
  graphe, ne prouve pas l'exploration libre, ou manque de continuite
  camera/trail.

Gates V2.8:

- surfaces materielles par zone dans `ZoneSurfaceSpec`: finish, motif, bandes,
  roles et signatures exposes dans le scene graph;
- guidage visuel derive de `worldRoutes`: chevrons et studs sur chaque segment
  de route, sans toucher a la physique de conduite;
- snapshot QA enrichi avec `surfaceObjects`, `surfaceSignatures`,
  `routeGuidanceObjects`, `routeGuidanceSignatures`,
  `routeGuidanceVisualizedSegments` et les compteurs de roles de guidage;
- rejet QA si une surface declaree n'est pas rendue, si les fingerprints de
  surface se dupliquent, si le graphe de route n'est pas materialise, ou si la
  scene depasse le budget d'objets fixe pour cette vague.

Gates V2.9:

- deux light-pools additifs reutilises, un sur la zone active et un sur la
  route proche, sans nouvelle vraie lumiere ni ombre dynamique;
- snapshot QA enrichi avec `lighting`: pools visibles, opacites, echelles,
  route proche, nombre de vraies lumieres et nombre de lumieres avec ombre;
- preuves perceptuelles par zone via ROI canvas de l'artefact signature actif:
  hash 8x8, luminosite, densite de contours, buckets couleur et ratio visible;
- rapport QA agrege `zone-perceptual-distance` et `all-zone-closeup-report`
  pour verifier que les zones couvertes par la mini-map ne partagent pas la
  meme empreinte visuelle;
- rejet QA si l'eclairage devient couteux, si les light-pools disparaissent, si
  les zones proches ont des hashes dupliques, ou si les preuves pixel manquent
  de contraste local.

Gates V3.0:

- couche `zone-place-architecture`: micro-architecture de lieu autour de chaque
  landmark, avec 10 familles distinctes (`neural-rack`, `gallery-canopy`,
  `scanner-forge`, etc.) et 4 objets par zone;
- les architectures de lieu encadrent les landmarks existants au lieu de les
  remplacer: portiques, racks, grues, colonnades, gantries, rails et champs de
  portail;
- snapshot QA enrichi avec `placeArchitectureObjects`,
  `placeArchitectureFamilies`, `placeArchitectureSignatures`, famille par zone,
  roles, bounds et fingerprint;
- rejet QA si une zone perd sa famille, si une signature se duplique, si les
  bounds ne forment pas une silhouette lisible, ou si le budget scene depasse le
  cap V3 fixe a 1080 objets.

Gates V3.1:

- projection screen-space des trois signes actifs du lieu: landmark,
  architecture de lieu et artefact signature;
- composition active calculee comme union de ces trois couches, avec nombre de
  couches visibles, aire clippee, distances entre centres, recouvrement entre
  couches et ratio de couche dominante exposes dans le rapport;
- verification Playwright `place-composition-visible` au chargement, sur le
  vrai trajet clavier et sur les sauts mini-map couverts par le profil QA;
- preuve locale par ROI canvas sur l'union de composition: luminosite, densite
  de contours et buckets couleur, plus mesure d'occlusion par l'UI visible;
- hook QA explicite `window.__IT_ART_STUDIO_QA_REFRESH__` pour rafraichir les
  projections screen-space juste avant les inspections, sans taxer le rendu en
  continu;
- rejet QA si le lieu actif est present dans l'inventaire mais ne se lit pas
  comme une scene 3D coherente a l'ecran.

Gates V3.2:

- `route encounters`: un portique procedural leger par route du graphe monde,
  rendu dans la couche `route-guidance` sans nouvelle vraie lumiere ni shadow
  map dynamique;
- feedback de proximite pendant la conduite: scale, lift, emissive et opacite
  reagissent quand le rover traverse un seuil de route;
- snapshot QA enrichi avec `routeEncounters`: nombre de gates, objets, gate
  actif, route active, distance, intensite, gates visites et intensite max;
- verification Playwright `route-encounters-rendered` pour prouver un gate par
  route en restant sous le budget scene V3;
- verification `route-encounter-triggered:real-drive` sur le vrai trajet
  clavier pour prouver que les seuils sont decouverts par conduite, avec
  couverture studio, tech et art.

Gates V3.3:

- `playable stage dominance`: l'interface doit laisser la scene 3D dominer le
  viewport, pas seulement rester sous un budget de couverture UI;
- panneaux plus compacts: panneau de zone, mini-map, nav mobile et pad mobile
  reduisent leur empreinte sans perdre le contact, les labels de zone ou les
  cibles tactiles;
- verification Playwright sur desktop, tablet, mobile et reduced-motion:
  dominance de scene, centre de viewport degage, rover lisible et composition
  active non masquee par l'UI;
- rapport QA enrichi avec le plus faible score de dominance et le ratio de
  centre jouable degage.

Gates V3.4:

- `gameplay moment visibility`: le runner ne prouve plus seulement que le rover
  roule et que les route encounters se declenchent; il prouve qu'un moment de
  jeu actif est lisible a l'ecran;
- snapshot QA enrichi avec `screen.playerRect` et `screen.activeRouteEncounter`
  pour projeter le rover et le seuil actif en bounding boxes screen-space;
- verification Playwright apres vraie conduite clavier vers un seuil connu:
  rover visible, route encounter actif, centre non masque par l'UI, ROI canvas
  echantillonnable, contours et buckets couleur suffisants;
- aucun nouvel objet 3D, aucune nouvelle lumiere: la vague renforce la preuve
  de qualite sans depasser le budget scene V3.

Gates V3.5:

- `scene graph headroom`: recuperer de la marge pour de futurs assets modelises
  sans retirer de lieu, de route, de feedback ou de preuve QA;
- les chevrons de route passent de deux barres dans un groupe a un seul mesh
  procedural en V, avec les memes roles, signatures et animations de guidage;
- verification Playwright `scene-graph-headroom`: scene sous 1040 objets,
  objets de guidage alignes sur le nombre attendu de chevrons, studs et gates,
  et conservation des preuves route-guidance, route encounters et gameplay
  moment visibility;
- objectif: sortir du plafond `1075/1080` avant d'ajouter des assets 3D plus
  ambitieux.

Gates V3.6:

- `prop cluster instancing`: convertir les petits props decoratifs des clusters
  en `THREE.InstancedMesh` pour recuperer du budget scene sans retirer les
  signes visuels de chaque lieu;
- les `118` props declaratifs restent comptes semantiquement dans le snapshot
  QA, tandis que le scene graph ne garde qu'un batch par cluster;
- verification Playwright `prop-cluster-instancing`: scene sous 955 objets,
  au moins 78 objets liberes depuis la baseline V3.5, au moins 120 depuis V3.4,
  `30/30` clusters instancies et `118/118` props instancies;
- conservation obligatoire de `world-richness`, `visual-specs-rendered`,
  `place-composition-visible`, `zone-perceptual-distance`, conduite clavier
  reelle et dominance de la scene jouable.

Gates V3.7:

- `project-artifacts-rendered`: ajouter une couche de preuves projet
  anonymisees sous forme de kits 3D proceduraux, un kit par zone;
- les kits utilisent `THREE.InstancedMesh`: `24` pieces semantiques visibles
  pour seulement `10` objets de scene, afin de garder le plafond V3.6 sous
  controle;
- chaque signature suit le format `project:<kind>:<zone>:<case>:<index>` et ne
  doit contenir ni client, logo, URL, domaine, metrique commerciale ni promesse
  non validee;
- verification Playwright `project-artifacts-rendered`: `10/10` zones couvertes,
  `20-30` pieces semantiques, `<=10` objets de scene, `>=10` familles
  d'activite, signatures sans doublon, materiaux par zone et scene totale
  `<=955`;
- le gate `prop-cluster-instancing` continue de reporter le budget net des
  artefacts projet pour prouver que les gains V3.6 restent intacts.

Gates V3.8:

- `project-artifact-visible`: projeter le kit projet actif dans le snapshot QA
  via `screen.activeProjectArtifact` et verifier sa lisibilite par bbox,
  occlusion UI, pixels ROI, edges et buckets couleur;
- la projection utilise les matrices reelles des `THREE.InstancedMesh`, afin
  que les bounds QA couvrent les pieces visibles du kit et pas seulement la
  geometrie source;
- `project-artifact-visual-coverage`: quick `4/4` zones, full `10/10` zones,
  avec rejet des rectangles quasi identiques au landmark, a l'architecture de
  lieu ou aux signature artifacts;
- contrainte conservee: aucun nouvel objet de scene, `sceneObjects <= 955` et
  `projectArtifactSceneObjects <= 10`.

Gates V3.9:

- `keyboard:directional-controls`: verifier sur une page `?qa=1&realKeys=1`
  que `ArrowUp`, `ArrowDown`, `ArrowLeft` et `ArrowRight` produisent de vrais
  deltas joueur avec `keyboard.down/up`, compteurs d'input, frames rendues et
  rotation du rover sur les directions laterales;
- le rapport QA doit exposer le score directionnel pour que la qualite
  "site jouable" soit lisible avant les parcours longs vers les zones.

Gates V4.0:

- `identity-ribbon-rendered`: ajouter un ruban 3D central `IT / STUDIO / ART`
  compose de tuiles instanciees, pixels suspendus, plaques typographiques et
  liaisons lumineuses pour materialiser la double identite dans le monde;
- les petites lumieres de route sont instanciees pour liberer du budget scene
  avant d'ajouter ce signe central, en gardant `sceneObjects <= 955`;
- `identity-ribbon-visible`: projeter le ruban dans le snapshot QA, verifier
  bbox, occlusion UI, ROI pixels, contours, couleurs et mouvement multi-frame.

Gates V4.1:

- `project-artifact-materialized`: transformer les kits projet anonymises en
  specimens proceduraux premium sans ajouter d'objet de scene net;
- `project-artifact-premium-visual-coverage`: verifier que chaque specimen
  echantillonne occupe une vraie surface, reste libre de l'UI et porte assez
  de lumiere, contours et couleurs pour lire comme un asset 3D premium;
- les familles `folio`, `capsule`, `lens`, `crystal` et `slab` sont des
  `BufferGeometry` composees et fusionnees: corps, reliefs, onglets, encoches,
  strates et temoins de lecture;
- le snapshot QA expose familles, profils de detail, signatures de relief,
  nombre de pieces procedurales et vertices uniques, avec conservation stricte
  de `projectArtifactSceneObjects <= 10` et `sceneObjects <= 940`.

Gates V4.2:

- `route-surface-materialized`: remplacer les tubes de routes simples par des
  rubans jouables proceduraux, composes d'un lit, de deux rails, de deux lignes
  signal et de traverses de flux fusionnees;
- `premium-world-detail-distribution`: mesurer chaque capture en grille canvas
  hors UI pour refuser les viewports trop plats, meme si les objets locaux
  passent leurs gates;
- la carte conserve le meme nombre d'objets de scene pour les routes: deux
  meshes de surface et un node par route, mais expose des signatures, pieces de
  detail et vertices pour prouver que les routes ne redeviennent pas des traits
  generiques;
- le budget strict reste `sceneObjects <= 940`, pour absorber les bassins et
  rampes instanciees sans ouvrir la porte a une inflation generale de la scene.

Gates V4.3:

- `keyboard:directional-controls` verifie une conduite vehicule: `ArrowUp`
  avance dans l'axe du rover, `ArrowDown` recule, `ArrowLeft` et `ArrowRight`
  tournent le rover sans translation laterale directe;
- la mini-map conserve un vrai deplacement guide vers la zone cible, sans
  contaminer la telemetrie physique du tour clavier reel;
- la rotation du rover est normalisee pour eviter les accumulations d'angle qui
  rendent les tests et les outils de debug illisibles;
- la telemetrie cinematique mesure la vitesse depuis la velocite physique, pas
  depuis les transitions d'interface, afin de detecter les vrais pics de
  conduite sans confondre un jump de mini-map avec une acceleration moteur;
- le monde gagne de l'echelle via la config partagee de carte, en conservant
  des hauteurs de couches distinctes pour limiter le z-fighting.

Gates V4.4:

- `project-themed-assets` verrouille les quatre lieux prioritaires:
  Observability, Cloud, Design et Contact doivent exposer un manifest
  thematique et des roles lies a de vraies signatures de relief;
- les manifests restent fusionnes dans les geometries instanciees existantes:
  aucun nouvel `Object3D`, `projectArtifactSceneObjects <= 10` et
  `sceneObjects <= 940`;
- le snapshot QA expose `projectArtifactRoleReliefSignatures` pour refuser les
  roles fantomes, plus `renderer.info` afin de preparer les plafonds draw calls,
  geometries, textures et triangles;
- le profil quick visite aussi Observability et Cloud via mini-map, et la
  mini-map separe les hitboxes Cloud/Mail sans modifier leurs positions monde.

Gates V4.5:

- `world-richness` exige maintenant des roles de decor lisibles pour
  `water-body` et `relief-ramp`, en plus des districts tech/art/studio;
- les bassins et rampes sont groupes en meshes instancies pour ajouter eau,
  relief et variations de conduite sans creer une foret d'objets Three.js;
- `audio-layer` prouve le bouton son, l'initialisation Web Audio, le moteur,
  l'ambiance, l'acceleration, le drift, les sons d'eau/rampe lies aux surfaces
  physiques, et le mute avec tous les gains remis a zero;
- les panels HUD sont compactes pour eviter d'occulter les specimens actifs,
  y compris en reduced-motion;
- le budget monde premium est nomme dans la QA (`sceneObjects <= 940`) et le
  rapport courant doit rester proche de `930/940`.

Gates V4.7:

- `premium-surface-details` exige une topographie jouable plus lisible:
  ecume autour des bassins, piquets de rive, chevrons de rampes et lignes de
  relief;
- ces details sont derives de `worldMaterialRegions` pour que le visuel de
  l'eau et des rampes reste aligne avec la physique du rover;
- toute la couche est instanciee dans un seul groupe afin d'ajouter du relief
  sans transformer la scene en foret d'objets;
- le budget reste strict: `sceneObjects <= 940`, avec au moins 17 roles de
  details de surface, 75 signatures de scenographie et 55 objets animes
  semantiques.

Gates V4.8:

- `real-drive-whole-map-freedom` prouve que le rover peut explorer les quatre
  quadrants et les bandes interieures nord/sud/est/ouest, loin du clamp de
  bord; en profil complet, la gate utilise les waypoints comme balises de
  conduite, mais valide surtout la couverture physique reelle de la carte;
- `real-drive-visible-boundary` prouve separement que les contacts avec les
  bords nord/sud/est/ouest sont intentionnels et lisibles;
- la physique expose `drive.boundary`: contacts par axe, vitesse de contact,
  distance au bord, distance minimale au bord et compteur de hard stop loin de
  la limite;
- Playwright utilise uniquement les vraies touches en `?qa=1&realKeys=1`;
- rejet QA si un trajet touche un stop loin du bord, si un bord n'est pas
  atteint, si le joueur quitte l'ecran, si le parcours manque d'off-road, ou si
  les sauts d'echantillons indiquent un teleport.

Gates V4.9:

- `themed-set-dressing` verifie que les lieux prioritaires ne redeviennent pas
  generiques: Cloud Dock doit exposer des racks serveur, des nuages et un arc
  electrique; Observability Tower doit exposer un ecran metrique, une pile de
  signaux et une trace; Design Atelier doit conserver mur canvas, swatches et
  outil peinture; Contact Portal doit lire comme un bureau postal avec desk,
  bac courrier, convoyeur et champ de reponse;
- `priority-place-composition-visible` prouve visuellement les quatre lieux
  prioritaires en combinant landmark, set dressing, architecture et signature
  artifact: les roles sont un prerequis, la preuve finale vient des rectangles
  projetes, de l'absence d'occlusion UI et du ROI canvas non plat;
- cette vague reste a budget scene constant: les primitives existantes sont
  remplacees par des formes plus narratives au lieu d'ajouter une couche de
  decoration.

Gates V5.0:

- `terrain-heightfield-materialized` ajoute un vrai heightfield procedural
  partage par le rendu et la physique: range de hauteur, normales, grade,
  vertex count et features exposes dans le snapshot QA;
- `vehicle-terrain-response` prouve par conduite clavier reelle que le rover
  suit le relief: hauteur terrain variable, garde au sol stable, pitch/roll
  correlés aux normales et plusieurs features traversees;
- le heightfield reste un seul mesh colore par vertex pour conserver le budget
  strict `sceneObjects <= 940` et eviter une inflation d'objets decoratifs.

Gates V5.1:

- Cloud Dock gagne un vocabulaire infra plus explicite dans son set dressing:
  control plane, pin de statut cluster et ligne de deploiement relient racks,
  nuages et arc electrique;
- `themed-set-dressing` refuse maintenant un Cloud Dock qui n'expose pas
  `control-plane-beacon`, `cluster-status-pin` et `deployment-lane`;
- cette vague reste volontairement frugale: le panneau canvas `CLOUD` est
  remplace par trois primitives procedurales, sans ajout net d'objets de scene,
  avec maintien obligatoire du budget `sceneObjects <= 940`.

Gates V5.2:

- les routes deviennent un guidage de gameplay moins dominant: underlay noir
  remplace par une empreinte terrain sombre, tres amincie et a basse opacite,
  rails rapproches, lane coloree plus lisible;
- les tirets de route sont remplaces par des mini-chevrons fusionnes dans la
  geometrie `route-lane`, sans nouvel `Object3D`;
- `route-surface-materialized` verifie maintenant le profil visuel des routes:
  ratios de rayon/offset, opacites, emissive, chevrons, absence d'ombre portee
  et `polygonOffset` pour limiter le scintillement terrain/route.
- les courbes de relief `terrain-contour` utilisent une encre topographique
  claire et tres transparente, separee du `inkMat` structurel, afin d'eviter
  les grands arcs noirs qui saturent les captures desktop/mobile.

Gates V5.3:

- `observability-tower` remplace son simple helix par une vraie silhouette de
  tour telemetry: mat central, base radar, pont de metriques, double couronne,
  trace echantillonnee et barres de latence;
- son set dressing abandonne les anneaux generiques au profit d'un vocabulaire
  instrumente: antenne, panneau metrique en relief et grille d'echantillons;
- `priority-signature-assets` exige les familles `telemetry-tower`,
  `trace-helix` et `metric-array` sur Observability, avec enveloppe lisible et
  maintien du budget `sceneObjects <= 940`.

Gates V5.4:

- `cloud-dock` remplace son vaisseau conteneur par une plateforme infra-cloud:
  dock flottant, runway de deploiement, racks edge, mat uplink, nuage et arc
  electrique;
- `priority-signature-assets` exige maintenant aussi les familles
  `cloud-platform`, `server-array` et `electric-cloud` sur Cloud Dock, avec une
  enveloppe lisible et sans desserrer le budget `sceneObjects <= 940`;
- cette vague ajoute de la silhouette dans la signature Cloud sans empiler du
  bruit de set dressing: le lieu doit lire comme une infrastructure connectee,
  pas comme une collection de petits blocs.

Gates V5.5:

- les racks edge de `cloud-dock` passent en `InstancedMesh`: trois racks restent
  declares comme objets, roles, signatures et variantes QA, mais ne consomment
  plus trois noeuds de scene distincts;
- le snapshot accepte des parties semantiques multiples sur un asset instancie
  (`signatureArtifactObjectCount`, roles/signatures/materials multiples) afin de
  separer la richesse lisible de la facture draw-call / scene graph;
- `signature-instancing-headroom` exige que Cloud conserve au moins neuf parties
  signature semantiques avec sept objets physiques ou moins, et que le monde
  reste dans le budget `sceneObjects <= 940`, rail de bord visible inclus;
- cette vague cree du headroom avant les prochains assets premium: toute
  augmentation de qualite doit conserver ou reduire le bruit structurel.

Gates V5.6:

- `design-atelier` remplace sa signature simple mur + swatches par un poste
  d'atelier plus lisible: canvas encadre, rails d'easel instancies, geste de
  peinture, table de drafting diagonale, light rig et rail matiere instancie;
- `priority-signature-assets` exige maintenant les familles `composition-wall`,
  `pattern-table`, `material-palette` et `atelier-light-rig` sur Design
  Atelier, avec au moins huit roles/signatures et une enveloppe 3D lisible;
- le set dressing `creative-direction-atelier` remplace le panneau texte par une
  table de drafting, un rouleau matiere, une lampe studio et un pin de layout:
  la zone doit se reconnaitre par silhouette et usage, pas par label;
- les repetitions d'atelier utilisent la meme logique semantique que Cloud:
  plusieurs parties QA distinctes peuvent etre portees par un `InstancedMesh`
  pour garder la qualite percue sans regonfler le scene graph.

Gates V5.7:

- `contact-portal` remplace sa signature ring + carte par un bureau postal
  miniature: comptoir, bac de tri, portail vertical de reponse, pile
  d'enveloppes instanciee, pli d'enveloppe, arc de signal et points de
  livraison instancies;
- `priority-signature-assets` exige maintenant les familles `postal-counter`,
  `reply-portal`, `mail-packet` et `delivery-signal` sur Contact Portal;
- le set dressing `postal-reply-office` retire le panneau `MAIL` au profit d'une
  pile courrier, d'un beacon de cachet et d'une lumiere courier: le lieu doit
  raconter le passage a l'action sans dependance a un label;
- `contact-signature-headroom` verifie que Contact conserve au moins onze
  parties signature semantiques avec sept objets physiques ou moins, en gardant
  `sceneObjects <= 940`, rail de bord visible inclus.

Gates V6.0:

- la taille du monde est centralisee dans `src/game/world-config.ts` et la carte
  jouable passe a `44x44`;
- les zones, routes, districts, eaux, rampes et reliefs sont repartis sur cette
  scene plus large afin d'obtenir une vraie sensation d'exploration, pas une
  limite repoussee autour d'un petit plateau;
- le seul blocage dur reste le bord du monde, maintenant materialise par un rail
  visible et expose en QA via `visibleBoundaryObjects >= 8`;
- `real-drive-whole-map-freedom` cible les bandes interieures `+-18.8`, et
  `real-drive-visible-boundary` force les contacts de bord a `+-23.8`: l'ancien
  monde compact ne peut plus valider les gates d'exploration.

Gates V6.1:

- la conduite doit produire une signature visuelle mesurable: roues avant qui
  braquent en mouvement, roulis/plongee du chassis, traces differenciees drift et
  freinage;
- `drive.vehicleFeel` expose `frontWheelSteer`, `peakChassisRoll`,
  `driftFxSamples`, `brakeFxSamples`, `maxSkidIntensity`, `driftTrailMarks` et
  `brakeTrailMarks`;
- `vehicle-feel-signature` joue un ruban clavier reel, capture drift/freinage et
  rejette un rover qui bouge sans retour visuel de pilotage;
- `audio-layer` exige maintenant une couche frein (`brakeGain`) en plus du
  moteur, de l'acceleration, du drift, de l'eau, des rampes et du mute strict.

Gates V6.2:

- les routes doivent se lire comme une piste d'exploration, pas seulement comme
  des lignes au sol: chaque trajet porte trois balises lumineuses instanciees
  avec hauteur et echelle alternees;
- `route-light-runway` exige `route-light >= routeCount * 3`, des signatures et
  roles de mouvement supplementaires, tout en gardant `sceneObjects <= 940`;
- cette tranche n'ajoute aucun nouvel `Object3D`: elle augmente la densite et la
  lisibilite du monde par instances dans les meshes existants.

Gates V6.3:

- les bassins et rampes ne partagent plus un motif uniforme: chaque region eau
  ou rampe porte un profil de micro-scene instancie (`harbor`, `lagoon`,
  `canal`, `cooling pool`, `delta`, `observability`, `art sweep`, `studio`,
  `mail bank`, `foundry`);
- `premium-surface-details` exige maintenant les quatre profils d'eau, les six
  profils de rampes, des signatures regionales sans doublon et au moins douze
  variantes de couleur d'instance;
- aucun nouvel `Object3D` n'est ajoute: la differenciation est portee par
  matrices, hauteurs, rotations, couleurs et signatures des `InstancedMesh`
  existants, pour garder le budget `sceneObjects <= 940`.

Gates V6.4:

- les FX dynamiques sous le rover ne sont plus des anneaux uniformes: l'eau
  emet `ripple`, `foam` et `wake`, les rampes emettent `skid`, `chevron` et
  `spark`, avec couleurs et formes d'instances distinctes;
- `surface-material-physics` exige maintenant des profils FX eau et rampe, des
  variantes de couleur, des signatures dynamiques et une variance de forme
  minimale, en plus des preuves physiques eau/rampe/terrain;
- la tranche conserve les deux `InstancedMesh` existants seulement: pas de
  nouvel `Object3D`, pas de nouvelle geometrie par frame, seulement matrices,
  couleurs d'instances et telemetry QA.

Gates V6.5:

- `3D Foundry` et `Fashion Room` entrent dans les zones prioritaires: elles
  doivent lire comme de vrais micro-lieux ART, pas comme des pictogrammes;
- Foundry expose maintenant scan rig, volumes de section et toolpath instancie;
  Fashion expose drape, runway, rails de patron et swatches matiere instancies;
- `art-premium-rooms` exige familles, signatures, roles, bounds et set dressing
  dedies pour les deux zones, tout en gardant `sceneObjects <= 940`;
- les panneaux litteraux `3D` / `MODE` ne portent plus seuls la comprehension:
  les roles de decor deviennent printer bed, resin vat, scan gantry, runway
  arch, fabric roll, mirror panel et pattern cutting table.

Gates V6.6:

- les balises globales de carte passent de poteaux individuels a deux
  `InstancedMesh` colores: meme lecture de micro-reperes, beaucoup moins de
  noeuds dans le scene graph;
- `premium-scene-headroom` exige au moins 24 slots d'objets libres sous le
  budget strict `sceneObjects <= 940`, tout en conservant 24 pieces semantiques
  de balises exposees par deux objets physiques maximum;
- `real-drive-tour` doit maintenant prouver explicitement les quatre
  destinations critiques `ai-lab`, `observability-tower`, `design-atelier` et
  `contact-portal` en vraies touches, sans hook deterministe;
- cette vague prepare l'ajout d'assets 3D plus ambitieux: chaque nouvelle
  silhouette doit entrer avec une marge mesurable et une preuve de conduite
  fiable au lieu de remplir le budget a l'aveugle.

Gates V6.7:

- les features physiques du terrain deviennent lisibles comme cartographie:
  chaque ridge, mound ou basin porte une empreinte, des strates et des pins
  instancies derives de `terrainConfig.features`;
- `terrain-feature-markers` exige au moins six pieces semantiques par feature,
  trois profils de relief et trois objets physiques maximum, pour renforcer la
  sensation de topographie sans transformer la scene en bruit;
- le gate conserve `premium-scene-headroom`: les marqueurs ajoutent une lecture
  de niveau et de relief, mais gardent au moins 24 slots libres sous
  `sceneObjects <= 940`.

Gates V6.8:

- le rover gagne quatre suspensions visibles qui compressent et rebondissent
  selon les samples terrain sous chaque roue, la vitesse laterale, l'eau, les
  rampes et le freinage;
- `vehicle-suspension-response` verifie en vraies touches clavier que les roues
  ne suivent pas le relief comme un bloc rigide: compression max, variance de
  course, span de contact terrain et nombre de samples de suspension sont
  exposes dans `drive.vehicleFeel`;
- cette vague accepte quelques pieces vehicule en plus, mais garde le budget
  monde premium et l'exploration libre comme gates bloquants.

Gates V6.9:

- `AI Lab` et `Observability Tower` ne doivent plus partager la meme grammaire
  cyan/anneaux/signaux: AI devient un atelier horizontal d'agents avec
  workbench, convoyeur d'evaluation, tokens de prompt et coeur compact;
  Observability devient une tour verticale avec lighthouse telemetry, cascade de
  logs, stack metrique et faisceau radar;
- `tech-place-distinctiveness` verifie les familles signature, les roles de set
  dressing, les proportions de silhouette et la distance perceptuelle
  AI/Observability apres les sauts mini-map;
- cette vague doit remplacer et condenser plutot qu'empiler: le monde conserve
  au moins 24 slots libres sous `sceneObjects <= 940`.

Gates V7.0:

- chaque lieu porte maintenant une signature sonore legere derivee de la zone
  active: mood, frequence d'ambiance, gain d'ambiance et offsets moteur /
  acceleration;
- `audio-layer` ne prouve plus seulement que des oscillateurs existent: il
  verifie aussi trois empreintes sonores distinctes `tech`, `art` et `studio`
  via navigation mini-map pendant que le son est actif;
- cette vague n'ajoute aucun `Object3D` et aucun asset audio lourd: elle cree
  une premiere sensation de soundscape jouable sans augmenter le budget scene,
  avant un futur sound pack plus riche.

Gates V7.1:

- les `route encounters` ne sont plus de simples anneaux: chaque route expose
  un micro-setpiece procedural fusionne en un seul mesh, avec profils
  `studio-threshold`, `tech-checkpoint`, `art-runway` et `contact-mail-gate`;
- la richesse vient des pieces internes de geometrie, pas d'une inflation du
  scene graph: un gate reste un objet logique traversable par route, sans
  collision ni obstacle invisible;
- `route-encounter-setpieces` verifie le nombre de profils, les signatures, les
  roles semantiques, le minimum de pieces par gate et le budget strict
  `sceneObjects <= 940`.

Gates V7.2:

- trois lieux prioritaires gagnent une silhouette dominante au lieu d'empiler de
  petits marqueurs: `Cloud Dock` ajoute une skybridge serveur-cloud, `Design
  Atelier` ajoute un mannequin de coupe, `Contact Portal` ajoute un mur de tri
  postal instancie;
- ces assets restent proceduraux mais modeles comme des objets narratifs: un
  visiteur doit reconnaitre cloud, atelier et poste avant de lire le panneau;
- `premium-landmark-hierarchy` verifie familles, roles signatures, bounds,
  nombre d'objets semantiques, objets physiques limites et headroom
  `sceneObjects <= 916`.

Gates V7.3:

- `3D Foundry` gagne une silhouette d'imprimante/scanner: rails verticaux,
  traverse haute, lit d'impression, bassin de resine et tete d'extrusion;
- l'asset est un seul `InstancedMesh` physique avec plusieurs pieces
  semantiques, pour augmenter la lisibilite sans gonfler le scene graph;
- `foundry-printer-hierarchy` exige la famille `printer-gantry`, les roles
  printer/resine/extruder, des bounds dominants et le meme headroom strict
  `sceneObjects <= 916`;
- `foundry-visual-proof` exige que la Foundry reste lisible dans la preuve
  mini-map/ROI, et `renderer-budget` surveille draw calls, triangles,
  geometries et textures pour eviter une qualite non maitrisable.

Gates V7.4:

- les bassins d'eau gagnent des traversees/pontons instancies afin de lire
  l'eau comme une piece de level design jouable, pas seulement une surface;
- `water-level-design` exige quatre bassins, seize planches de traversee
  signees, des profils distincts par bassin et le cap strict `sceneObjects <= 916`;
- l'ajout reste dans `surface-detail` pour augmenter la silhouette du monde
  sans ouvrir une nouvelle famille d'objets couteuse.

Gates V7.5:

- la QA `static dist` gagne `bruno-simon-playable-proof-reel`: un
  contact sheet ou une courte sequence de preuves produite depuis le build
  production, couvrant home, les dix lieux via mini-map, trois route encounters
  au clavier reel et un passage mobile/touch en scope local complet;
- le scope CI garde la meme gate mais limite les captures de lieux a trois zones
  representatives et un route encounter clavier stable pour que Pages reste
  deployable a chaque push;
- cette gate doit rendre le livrable auditable humainement, pas seulement
  verifier que le canvas charge.

Gates V8.0:

- `bruno-simon-grade-objective` devient la definition bloquante de qualite:
  assets 3D par lieu, textures propres, niveau plus vaste, eau, relief, routes
  et surfaces libres doivent etre lisibles dans le rendu;
- la physique vehicule doit etre jugee sur conduite reelle: acceleration,
  freinage, drift, inertie, braquage en mouvement, son moteur et absence de
  rotation statique comme comportement principal;
- `real-drive-free-roam` doit rester la preuve d'absence de murs invisibles: le
  vehicule peut quitter les routes, traverser les districts et revenir vers les
  lieux sans blocage;
- les futurs assets GLB/glTF doivent etre introduits seulement avec manifest,
  licence, budget, fallback procedural et preuve visuelle dans le rapport QA.

Gates V8.1:

- `assets/world-assets.manifest.json` devient le point d'entree obligatoire de
  la boucle asset-first: aucune extension de map ne part sans source, licence,
  role narratif, budget et prochaine action par asset;
- `npm run assets:validate` bloque les sources sans licence commerciale, les
  assets acceptes sans fichier local, les modeles sans budget triangle/poids et
  les hero locations sans couverture candidate;
- la premiere curation couvre 10 sources, 16 assets candidats, les roles
  terrain `road`, `water`, `relief`, `vegetation`, `route-edge`, `bridge`, et
  les trois hero locations `Cloud Dock`, `Design Atelier`,
  `Observability Tower`;
- les assets restent au statut `candidate` tant qu'ils ne sont pas telecharges,
  optimises et prouves visuellement; `integrated` exige une preuve QA.

Gates V8.2:

- la premiere bibliotheque runtime acceptee contient 47 GLB CC0 Kenney, separes
  par role de level design: routes, route-edge, ponts, relief, eau et
  vegetation;
- les licences des packs acceptes sont copiees avec les modeles sous
  `public/assets/models/vendor/kenney`, et le manifest garde source, role
  narratif, poids, triangles, budget et prochaine action;
- `npm run assets:validate` lit directement les GLB acceptes pour verifier le
  poids local, le nombre de fichiers, les triangles et les budgets avant toute
  integration Three.js;
- la prochaine boucle doit construire l'adapter/loader de preview asset-first,
  puis composer une map plus grande a partir de ces pieces au lieu d'ajouter du
  bruit procedural.

Gates V8.3:

- `src/game/asset-loader.ts` lit le manifest asset-first et construit les URLs
  runtime avec `import.meta.env.BASE_URL`, afin que les GLB fonctionnent en
  local comme sur GitHub Pages;
- `?assets=preview` active une planche runtime separee qui charge six specimens
  GLB acceptes, un par role terrain: road, route-edge, bridge, relief, water et
  vegetation;
- la preview reste opt-in: l'URL publique normale conserve les fallbacks
  proceduraux et le budget existant tant que la grande map n'a pas ete
  recomposee;
- `external-asset-preview-runtime` devient la preuve QA minimale du pipeline:
  fichiers GLB visibles, chemins publics sans `public/`, six roles couverts,
  aucune erreur de chargement et capture canvas non plate.

Gates V8.4:

- `?assets=map` active une couche runtime opt-in qui place les GLB acceptes
  comme vocabulaire de level design, au lieu de les aligner en planche:
  routes, route-edge, ponts, eau, relief et vegetation sont derives des
  `worldRoutes`, des regions d'eau et du terrain existant;
- le loader cache chaque URL GLB unique puis clone les scenes normalisees afin
  de separer `uniqueFiles` et `placements`, et d'eviter qu'une composition map
  multiplie inutilement les chargements;
- la telemetrie `externalAssets.mode` distingue `off`, `preview` et `map`, avec
  `placements`, `clusters`, placements lies aux routes/eau/relief/vegetation,
  couverture et chemins publics Pages-safe;
- `external-asset-map-composition` exige une preuve topologique opt-in:
  au moins 32 placements, 18 fichiers uniques, 8 clusters, les six roles terrain,
  les 11 routes liees, quatre regions d'eau, cinq reliefs, douze vegetations,
  une couverture de map large et une capture canvas non plate;
- le runtime public normal reste procedural tant que la composition GLB n'a pas
  ete simplifiee visuellement et promue sans bruit.

Gates V8.5:

- la couche `?assets=map` porte maintenant une curation explicite par placement:
  `primary`, `support` ou `context`, plus un marqueur `promotionCandidate` pour
  preparer la future promotion selective dans le runtime public;
- les placements `support` et `context` sont reduits a l'echelle afin de
  diminuer le bruit de la preuve map sans cacher les assets acceptes;
- chaque placement expose une garde au sol derivee de son role terrain, et la
  QA mesure ensuite la bounding box reelle apres normalisation/scale pour
  refuser les risques de placement coplanaire avec les routes, l'eau ou le
  terrain;
- `external-asset-map-composition` exige maintenant aussi des seuils de
  curation: placements primaires/support/context, candidats de promotion,
  densite maximum par cluster, absence de risque de z-fighting et rectangles
  ecran visibles pour les familles route, eau, relief et vegetation;
- cette etape ne promeut toujours rien dans l'URL publique normale: elle prepare
  une selection plus propre des assets qui remplaceront ensuite le bruit
  procedural.

Gates V8.6:

- `public/assets/textures/map/` contient maintenant une premiere grammaire
  texture runtime pour route, field/vegetation, eau et relief;
- ces textures restent stylisees et legeres en SVG afin de respecter le langage
  low-poly actuel avant d'introduire des PBR externes plus lourds;
- `assets:validate` analyse les texture-sets acceptes, verifie leurs fichiers,
  leur poids, leur `publicPath` GitHub Pages-safe et refuse les textures map
  runtime non declarees;
- la prochaine boucle peut agrandir le terrain avec une base materiau verifiee
  au lieu d'etirer uniquement des aplats proceduraux.

Gates V8.7:

- la carte jouable passe de `44x44` a `56x56`, avec zones repositionnees,
  routes allongees, eau, rampes et features terrain redeployees sur les bords
  pour donner de vraies respirations d'exploration;
- l'expansion ne gonfle pas le scene graph par reflexe: les nouvelles eaux,
  rampes et marqueurs restent portes par les familles instanciees existantes;
- la QA `real-drive-whole-map-freedom` cible maintenant les bandes interieures
  `+-24.2`, et `external-asset-map-composition` doit prouver une couverture GLB
  d'au moins `42x42`;
- cette tranche prepare les trois hero locations premium en augmentant l'espace
  disponible avant d'ajouter des assets plus narratifs.

Gates V8.8:

- la couche opt-in `?assets=map` compose maintenant trois clusters GLB
  narratifs pour les hero locations `Cloud Dock`, `Design Atelier` et
  `Observability Tower`, a partir des assets CC0 deja acceptes;
- chaque cluster expose une telemetrie `heroLocation`: trois placements, trois
  roles narratifs et un rectangle ecran mesure en QA apres saut mini-map;
- `external-asset-map-composition` ne prouve plus seulement la couverture
  terrain: il doit aussi charger neuf placements hero-location et capturer les
  trois lieux en contexte;
- cette etape reste une preuve de composition avant promotion dans l'URL
  publique normale, afin de continuer a reduire le bruit procedural lieu par
  lieu.

Gates V8.9:

- la bibliotheque runtime accepte maintenant une selection courte du Kenney
  Factory Kit: 23 GLB industriels, ecrans, tuyaux, plateformes, machines et
  surfaces de travail pour un total de 502.8 KB et 5 240 triangles;
- les placements hero-location peuvent cibler un `assetId` precis, ce qui
  permet de charger une collection narrative sans maquiller un ecran ou une
  machine en role terrain generique;
- `Cloud Dock`, `Design Atelier` et `Observability Tower` ont chacun un contrat
  `heroLocationCuration` dans le manifest: signature visuelle, assets acceptes,
  six roles minimum, seuil de placements runtime et prochaine piece custom a
  sourcer ou modeliser;
- la couche `?assets=map` ajoute des racks, cables, ecrans, catwalks, tables de
  coupe, caisses et panneaux de trace aux trois lieux, tout en gardant ces
  ajouts opt-in jusqu'a validation visuelle;
- `assets:validate` refuse maintenant une hero location sans contrat de
  curation, sans roles visuels suffisants ou avec des assets requis non
  acceptes.

Gates V8.10:

- `scripts/generate-signature-assets.mjs` genere une premiere collection GLB
  locale et reproductible pour les trois silhouettes manquantes:
  `server-cloud-node.glb`, `atelier-mannequin-rack.glb` et
  `telemetry-radar-mast.glb`;
- cette collection `accepted-itart-signature-hero-core` pese 164.7 KB pour
  3 988 triangles et reste dans un langage low-poly compatible avec les packs
  Kenney deja acceptes;
- chaque hero location possede maintenant une piece signature dediee dans
  `?assets=map`, au lieu de dependre uniquement de metaphors industrielles:
  Cloud Dock a son node serveur/nuage, Design Atelier a son mannequin + rail
  textile, Observability Tower a son mat radar/telemetrie;
- les contrats `heroLocationCuration` exigent ces roles signature, et la QA
  `external-asset-map-composition` refuse un lieu qui perd son role custom;
- les prochains remplacements premium devront partir de ces silhouettes comme
  briefs Blender: rack serveur plus riche, mannequin drape, mat radar anime.

Gates V8.11:

- la carte jouable passe de `56x56` a `68x68`, avec zones, routes, eau,
  rampes, relief et vegetation redeployes pour creer de vrais trajets et des
  respirations peripheriques;
- les trois clusters GLB hero-location restent attaches a leurs nouveaux lieux:
  `Cloud Dock` au sud-ouest tech, `Design Atelier` a l'est art et
  `Observability Tower` au nord-ouest tech;
- `real-drive-whole-map-freedom` cible maintenant les bandes interieures
  `+-29.4`, et `external-asset-map-composition` doit prouver une couverture GLB
  d'au moins `56x56`;
- cette tranche garde le gameplay comme support: la preuve principale est une
  map plus grande, plus lisible, avec assets et surfaces materialises sans
  obstacle invisible.

Gates V8.12:

- `scripts/generate-signature-assets.mjs` genere une seconde vague GLB locale
  pour densifier les trois hero locations sans attendre Blender:
  `cloud-circuit-bridge.glb`, `atelier-drape-frame.glb` et
  `telemetry-screen-array.glb`;
- la collection `accepted-itart-signature-hero-core` passe a 6 GLB locaux,
  317.2 KB et 7 592 triangles, avec un budget manifeste monte a 380 KB /
  8 200 triangles pour garder une marge de remplacement premium;
- `Cloud Dock`, `Design Atelier` et `Observability Tower` ont maintenant deux
  signatures custom chacun: node serveur + pont circuit, mannequin + drape
  frame, mat radar + screen array;
- `external-asset-map-composition` exige ces nouveaux roles custom en runtime,
  et les nouveaux accents sont places dans des micro-clusters dedies afin de
  conserver le plafond de densite des clusters hero-location;
- le gate `premium-world-detail-distribution` juge maintenant le cluster plat
  maximum en mediane sur trois echantillons, comme les autres metriques de
  detail, tout en gardant `maxObservedFlatCluster` dans le rapport pour
  diagnostiquer les outliers de transition camera;
- l'objectif de boucle reste asset-first: chaque nouvelle piece doit renforcer
  la silhouette du lieu avant tout agrandissement ou enrichissement procedural.

Gates V8.13:

- les quatre textures SVG acceptees dans le manifest sont maintenant promues en
  runtime dans `src/game/world-scenery.ts`: road, water, relief et vegetation;
- les textures passent par `import.meta.env.BASE_URL`, avec chemins publics
  GitHub Pages-safe et repetition controlee pour eviter les aplats de map;
- le snapshot QA expose `mapTextureRoles`, `mapTextureUrls` et
  `mapTextureMaterialCount`, puis le gate `map-texture-runtime` refuse une map
  qui perd un role texture ou depasse le budget renderer;
- les plaques de district restent plus legeres afin que les textures terrain
  restent visibles et que la lisibilite des zones ne repose pas sur un voile
  colore.

## Components

- `game-site`: surface principale.
- `studio-game`: canvas + HUD + panels.
- `world-map`: mini-map.
- `zone-panel`: contenu de la zone active.
- `mobile-drive`: controles tactiles.
- `fallback-zone-list`: contenu lisible sans WebGL.
