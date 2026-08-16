# Design

## Direction

Une vitrine sombre, divisée par un axe vertical continu : ART occupe la moitié
gauche et IT la moitié droite, du haut jusqu'au bas de la page. Le mot STUDIO
occupe la couture centrale et matérialise ce qui rassemble les deux disciplines.

## Système visuel

- fond graphite profond, sans gradients décoratifs ;
- cyan électrique réservé à IT ;
- corail cuivré réservé à ART ;
- ivoire chaud pour STUDIO, les grands titres et la méthode, sur fond sombre ;
- IBM Plex Sans pour la structure et Instrument Serif pour les titres ;
- traits fins, grandes respirations, angles francs, aucune carte vitrée ;
- une image documentaire sombre par pratique, générée sans texte ni logo.

L'axe vertical est le seul trait autorisé à traverser la page. Aucun séparateur
horizontal ne peut le couper. Les séparateurs internes éventuels restent
strictement contenus dans leur moitié ART ou IT.

## Hero

Le desktop présente deux panneaux 50/50 sur une hauteur d'écran. ART reste à
gauche et IT à droite. Dans le titre central, IT apparaît en premier à droite de
l'axe, ART vient ensuite à gauche et STUDIO reste centré sous les deux. Une
couche sombre garantit la lisibilité du texte.

La vidéo possède trois cadrages synchronisés : plan 16:9 complet au-dessus de
1100 px, deux crops indépendants de 761 à 1100 px pour rapprocher Carine et
Amine sans les couper, puis une composition 9:16 dédiée jusqu'à 760 px. Le titre
central est l'unique signature de navigation : il se compacte sur les derniers
20 % du scrub, rejoint le centre supérieur et reste fixé pendant le reste de la
page. Aucun header ou contact décoratif ne lui fait concurrence.

Les fichiers AVIF sont servis en priorité, puis WebP et JPEG. Ils portent des
dimensions explicites pour éviter les décalages de mise en page.

## Responsive et accessibilité

- navigation secondaire masquée sur petit écran, contact toujours visible ;
- composition desktop et tablette maintenue en deux moitiés autour du même axe ;
- composition vidéo mobile 9:16 jusqu'à `760px`, avec ART à gauche et IT à droite ;
- largeur minimale validée à `320px` sans défilement horizontal ;
- focus clavier visible et liens identifiables sans dépendre de la couleur ;
- HTML sémantique, un seul `h1`, textes alternatifs descriptifs ;
- aucune fonctionnalité essentielle liée au mouvement ou au JavaScript.

## Chorégraphie des sections

- les prestations ART entrent depuis la gauche et les prestations IT depuis la
  droite ;
- les logos de références apparaissent par masque, netteté et échelle, afin de
  compléter leur entrée depuis la moitié ART ou IT ;
- la méthode alterne gauche, droite, gauche sur trois rangées successives ;
- la section contact présente une invitation et une adresse propres à chaque
  pratique ;
- la méthode et le contact utilisent des halos diffus corail et cyan, bornés à
  leur section et placés derrière le contenu ;
- `prefers-reduced-motion` neutralise les transitions sans masquer de contenu.

## Règles de continuité

Ne pas ajouter de gradients marketing, métriques sans source, faux témoignages,
carrousels automatiques, formulaires non fonctionnels ni dépendance client lourde.
Une future vidéo doit conserver l'image actuelle comme poster et fallback.
L'axe central est unique : aucune section ne crée sa propre variante du trait.
Les sections de l'accueil restent pleine largeur ; seuls leurs contenus internes
reçoivent le padding latéral, afin que fonds et halos touchent toujours les bords
du viewport.
