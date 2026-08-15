# IT Art Studio — vitrine statique de production

## Décision

IT Art Studio remplace temporairement le mini-monde WebGL par une vitrine
statique, éditoriale et immédiatement exploitable. La version interactive est
conservée sur la branche `codex/interactive-world-v10-archive` et ne participe
pas au bundle public.

La nouvelle vitrine reprend la meilleure idée de la première direction : une
composition divisée entre IT et ART, réunie par STUDIO. Le split est visuellement
équilibré, tandis que la hiérarchie commerciale donne environ 60 % du contenu à
la pratique IT, qui reste le moteur principal de l'entreprise.

## Approches évaluées

1. **Split éditorial statique — retenu.** Deux univers photographiques, une
   structure HTML simple, quelques transitions CSS et aucun moteur graphique.
   C'est la meilleure combinaison de singularité, rapidité et fiabilité.
2. **Retour à la maquette V1 claire.** Plus conventionnelle et facile à lire,
   mais moins alignée avec la demande d'un univers sombre et avec l'identité
   IT/ART déjà développée.
3. **Split vidéo dès la première publication.** Plus spectaculaire, mais plus
   lourd, plus fragile sur mobile et inutile pour satisfaire l'objectif urgent.
   Les images-mères pourront être animées ensuite sans changer l'architecture.

## Identité visuelle

- Fond graphite presque noir, sans effet « SaaS dashboard ».
- Moitié IT : noir bleuté, cyan électrique retenu, image d'architecture
  technique et de signaux observables.
- Moitié ART : noir chaud, cuivre/corail, image de matière, volume et atelier.
- Axe STUDIO : ivoire chaud, ligne verticale sur desktop et transition
  horizontale sur mobile.
- Typographie : sans-serif nette pour l'interface et serif éditoriale pour les
  grands titres. Les fontes restent locales au bundle.
- Images : deux images 16:9 générées dans Higgsfield avec Nano Banana Pro,
  conçues comme une paire. Elles ne contiennent ni texte, ni logo, ni marque
  tierce, ni personne identifiable. L'image existante
  `studio-artefacts.png` reste un fallback disponible, mais n'est pas le
  principal visuel si la nouvelle paire est validée.

La première publication utilise uniquement des images. Une évolution vidéo
pourra animer chaque image avec Seedance, en conservant les images comme posters,
fallback `prefers-reduced-motion` et fallback mobile. Cette évolution ne bloque
pas la mise en ligne.

## Architecture de page

### En-tête

En-tête compact avec la marque légale `IT Art Studio`, des ancres vers
`Expertises`, `Approche` et `Contact`, puis un CTA mail. Aucun lien social ou
externe n'est publié tant que sa destination exacte n'est pas validée.

### Hero split

Le hero occupe la majeure partie du premier écran. À gauche, IT présente la
promesse de clarifier, fiabiliser et faire évoluer les systèmes. À droite, ART
présente la capacité à donner forme, matière et présence aux idées. Le centre
porte `STUDIO` et une phrase commune : transformer la complexité en exécution
nette.

Sur mobile, les deux moitiés sont empilées et conservent chacune une image, une
promesse et un lien d'ancrage. Le contenu utile ne dépend d'aucun hover.

### Description de l'activité

Le texte principal décrit concrètement l'objet de la société : conseil,
accompagnement et formation en informatique et audiovisuel ; conception et
réalisation de solutions, prototypes et contenus ; design 3D ; conception et
vente de vêtements. Le texte commercial reste fidèle à cet objet sans promettre
de résultat chiffré ni citer de client non autorisé.

### Expertises

Six offres maximum, présentées sans faux cas client :

- Observabilité et fiabilité : stratégie de télémétrie, diagnostic et
  industrialisation OpenTelemetry.
- Architecture, cloud et scaling : cadrage, arbitrages, revue de systèmes et
  trajectoire de delivery.
- IA, produit et prototypes : clarification du besoin, preuve de concept et
  passage vers un produit exploitable.
- Formation et accompagnement : sessions ciblées, coaching technique et
  transfert de compétences.
- Design 3D et direction visuelle : volumes, objets, univers et rendus.
- Contenu et collection : conception de contenus audiovisuels, pièces et
  collections capsules.

Les quatre premières offres portent le poids commercial IT. Les deux dernières
installent la singularité ART sans faire passer le studio pour une agence
généraliste.

### Approche

Trois étapes : clarifier, construire, mettre en valeur. Cette section explique
le lien entre conseil, conception et création sans ajouter de jargon ni de faux
processus propriétaire.

### Contact

Un seul canal de conversion : `mailto:amine@itart.studio`. L'adresse est visible
en clair et utilisée par tous les CTA. Il n'y a ni formulaire, ni réservation,
ni collecte de données dans cette version.

### Mentions légales

Une page dédiée `/mentions-legales/` et un lien de footer publient au minimum :

- dénomination : IT Art Studio ;
- forme : société à responsabilité limitée (SARL) ;
- capital social : 1 000 € ;
- siège : 143 rue René Tachon, 69250 Curis-au-Mont-d'Or, France ;
- SIREN : 915 019 129 ;
- RCS : Lyon 915 019 129 ;
- TVA intracommunautaire : FR79 915019129 ;
- gérants et directeurs de la publication : Carine Cléon-Amanzou et Amine
  Amanzou ;
- contact : amine@itart.studio ;
- hébergeur : Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen,
  Allemagne, `info@hetzner.com`, +49 (0)9831 505-0.

Les informations d'entreprise sont recoupées avec l'état RNE/RCS public récent.
Le nom affiché conserve la casse `IT Art Studio`, conforme aux actes publiés.

## Composants et dépendances

- Astro produit uniquement des fichiers statiques.
- Le layout commun gère le titre, la description, la canonical, les métadonnées
  sociales et les icônes.
- La home et les mentions légales sont deux pages HTML autonomes.
- Le CSS définit la palette, le split, la grille éditoriale, le responsive et
  `prefers-reduced-motion`.
- Aucun Three.js, GSAP, Lenis, WebGL, tracker, cookie ou appel réseau client ne
  doit apparaître dans le bundle de production.
- Les images sont optimisées en AVIF/WebP avec une source JPEG ou PNG de secours.

## Accessibilité et comportement dégradé

- Structure sémantique, un seul `h1`, ancres nommées et skip-link.
- Contrastes WCAG AA, focus visible et zones tactiles d'au moins 44 px.
- Alt text descriptif pour les images porteuses de sens ; décorations masquées.
- Aucun contenu n'est inaccessible sans JavaScript.
- À 320 px, aucun débordement horizontal et aucune ligne de texte tronquée.
- Les animations non essentielles sont neutralisées avec
  `prefers-reduced-motion`.

## QA

Les contrôles bloquants sont :

- `astro check`, audit de dépendances et build statique ;
- scan du bundle interdisant les marqueurs WebGL, les placeholders, les liens
  `href="#"`, l'ancienne adresse de contact et les expressions « bientôt
  disponible » ;
- crawl local de toutes les pages et de tous les liens internes ;
- assertions sur la présence du nom légal, du contact et des mentions SARL ;
- captures Playwright desktop 1440 px, tablette 768 px et mobile 390/320 px ;
- vérification visuelle du hero, des services, du footer et des mentions légales ;
- test du conteneur et de `/healthz` avant publication ;
- vérification publique DNS, redirection HTTP vers HTTPS, certificat, codes 200,
  absence de mixed content et rendu mobile/desktop.

## Déploiement

Le schéma reproduit celui d'AmineAmanzouWebsite :

1. GitHub Actions vérifie, construit et scanne le site.
2. Une image Caddy statique immuable est publiée dans GHCR avec un tag SHA,
   signature et attestations.
3. Le digest vérifié est promu sans reconstruction.
4. TheUnreliableInfrastructure ajoute un service `itart-studio-website`, son
   compose, son routage Caddy et un workflow Argo de pull/deploy par digest.
5. Le DNS public Cloudflare route `itart.studio` et `www.itart.studio` vers
   `web-prod` ; Caddy fournit HTTPS et redirige `www` vers le domaine canonique.
6. Le déploiement est validé depuis Internet. Le digest précédent reste le
   mécanisme de rollback.

La mise en ligne n'est terminée que lorsque `https://itart.studio` répond
publiquement avec un certificat valide et le contenu décrit ci-dessus.
