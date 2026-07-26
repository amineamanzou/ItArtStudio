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

- Deplacement clavier vehicule sur desktop: gauche/droite orientent le rover,
  haut/bas avancent ou reculent dans l'axe du vehicule.
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
- le monde gagne de l'echelle (`mapRange = 34`, terrain et districts agrandis)
  en conservant des hauteurs de couches distinctes pour limiter le z-fighting.

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
  l'ambiance, le drift et le mute avec gains remis a zero;
- les panels HUD sont compactes pour eviter d'occulter les specimens actifs,
  y compris en reduced-motion;
- le budget monde premium est nomme dans la QA (`sceneObjects <= 940`) et le
  rapport courant doit rester proche de `930/940`.

## Components

- `game-site`: surface principale.
- `studio-game`: canvas + HUD + panels.
- `world-map`: mini-map.
- `zone-panel`: contenu de la zone active.
- `mobile-drive`: controles tactiles.
- `fallback-zone-list`: contenu lisible sans WebGL.
