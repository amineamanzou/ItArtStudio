# Design

## Direction

Une vitrine sombre, divisée par un axe vertical continu : ART occupe la moitié
gauche et IT la moitié droite, du haut jusqu'au bas de la page. Le mot STUDIO
occupe la couture centrale et matérialise ce qui rassemble les deux disciplines.

## Système visuel

- fond graphite profond, sans gradients décoratifs ; le reflet des strates ART
  de la hero est une matière, borné à sa moitié ;
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

Le premier écran présente deux champs 50/50 sur une hauteur d'écran, à toutes
les largeurs jusqu'à 320 px. ART reste à gauche et IT à droite. Dans le titre
central, IT apparaît en premier à droite de l'axe, ART vient ensuite à gauche et
STUDIO reste centré sous les deux, sur la couture. Un voile sombre suit la
signature et le bas de l'écran pour garantir la lisibilité.

Aucune vidéo ni image ne compose le fond. La composition abstraite repose sur un
seul signal lu de deux façons, généré au build (`src/data/hero-field.ts`) :

- quatre strates pleines et deux échos au trait, identiques dans chaque moitié ;
- ART trace le signal en courbes continues, strates cuivre et corail éclairées
  à la crête, avec un grain de matière ;
- IT échantillonne et quantifie le même signal en marches cyan, sur une grille
  de colonnes parcourue par un curseur ;
- un temps commun de 1,2 s : chaque marche IT avance d'un échantillon par temps,
  ART glisse en continu et respire sur quatre temps. Les deux lectures se
  rejoignent sur l'axe à chaque temps.

À l'arrivée, les deux champs s'ouvrent depuis la couture, puis l'animation
continue sans interaction. Elle n'utilise que des transformations CSS, fonctionne
sans JavaScript et se met en pause lorsque la hero quitte l'écran. Sous 760 px,
chaque moitié porte une seule période et huit colonnes pour rester lisible.

Le titre central est l'unique signature de navigation : la scène reste épinglée
pendant un court défilement, le titre se compacte, rejoint le centre supérieur
et reste fixé pendant le reste de la page. Aucun header ou contact décoratif ne
lui fait concurrence.

Avec `prefers-reduced-motion`, la composition est figée sur l'instant où les deux
lectures coïncident à la couture, et la signature est directement compacte.

## Responsive et accessibilité

- navigation secondaire masquée sur petit écran, contact toujours visible ;
- composition desktop et tablette maintenue en deux moitiés autour du même axe ;
- composition abstraite en deux moitiés jusqu'à `320px`, avec ART à gauche et IT
  à droite ;
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
Le premier écran ne charge aucune vidéo d'arrière-plan. Toute évolution de la
hero conserve une composition fixe et intentionnelle en mouvement réduit.
L'axe central est unique : aucune section ne crée sa propre variante du trait.
Les sections de l'accueil restent pleine largeur ; seuls leurs contenus internes
reçoivent le padding latéral, afin que fonds et halos touchent toujours les bords
du viewport.

Sur desktop et tablette, les contenus textuels s'ancrent vers l'axe plutôt que
vers les bords extérieurs : prestations ART à droite de leur moitié, prestations
IT à gauche, méthode et contact en miroir. Les couleurs et les halos continuent
de remplir le viewport. Le footer prolonge les halos du contact, reprend la
signature composée de la hero et ne répète aucune adresse email.
