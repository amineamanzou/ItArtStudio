# Design

## Direction

IT Art Studio s'ouvre sur deux matières réunies par la même signature. IT occupe
la moitié gauche en jaune et ART la moitié droite en violet. Le mot STUDIO en
ivoire traverse visuellement la couture. L'axe prolonge cette composition sur
ordinateur et tablette, jusque dans le pied de page.

## Système visuel

- Graphite pour le fond et ivoire pour le texte courant et STUDIO.
- Jaune chaud pour la géométrie, les liens et les repères IT. Violet pour les
  volumes, les liens et les repères ART.
- IBM Plex Sans pour la signature, les libellés et les prestations. Instrument
  Serif reste la voix des grands titres de la méthode, du contact et des pages
  légales.
- Traits fins et angles francs. Chaque séparateur horizontal reste dans sa
  moitié.

## Premier écran

Les deux champs couvrent chacun la moitié du premier écran, jusqu'à 320 px. Le
titre IT ART STUDIO occupe le centre et les deux liens de pratique restent
visibles sous les accroches. Un voile stable ménage une zone de lecture autour
du titre et au pied de la scène. Le premier défilement révèle les prestations.
La signature quitte l'écran avec la scène.

La composition SVG est produite au build. Les blocs isométriques IT se
ramifient à trois profondeurs depuis une forme principale. Les facettes et
leurs tracés réagissent à une lumière jaune diffuse. Les rubans ART se
recouvrent, avec des liserés fins et un reflet violet qui se déplace sur leur
surface. À l'arrivée, les matières prennent leur luminosité puis évoluent à
des rythmes distincts. La scène utilise des animations CSS et se met en pause
hors écran. Avec `prefers-reduced-motion`, la géométrie, les reflets et la
signature restent fixes au même emplacement.

## Suite de la page

- Les prestations, les références puis les contacts suivent chacun l'ordre
  IT / ART. Les colonnes se succèdent dans cet ordre sur mobile.
- Les prestations viennent du côté de leur pratique. Les logos ajoutent un
  masque, un changement de netteté et d'échelle à leur entrée. Le logo
  officiel d'Orange conserve ses couleurs dans les références IT.
- La méthode alterne gauche, droite, gauche. Les halos de la méthode et du
  contact reprennent le jaune à gauche et le violet à droite. Le pied de page
  prolonge les halos du contact et reprend la signature.

## Continuité et vérification

La scène et ses destinations sont utilisables sans JavaScript. Le site garde
un seul `h1` par page, un focus visible, des libellés explicites et des textes
alternatifs pour les logos. En mouvement réduit, les révélations de section
laissent le contenu immédiatement visible.

Le premier écran utilise du HTML, des SVG et du CSS. Le site sert ses polices
localement et la page d'accueil ne charge ni vidéo de fond ni traceur. Les
sections gardent leurs fonds pleine largeur, avec le retrait latéral appliqué
au contenu.

La QA statique vérifie le contraste de la signature et des liens pendant le
mouvement, y compris à 1440 × 650. Elle couvre le rendu à 320 px, le premier
défilement, les deux parcours au clavier et le mouvement réduit.
