# Finalisation de la hero responsive

## Portée approuvée

Cette passe retire le header décoratif de la page d'accueil et transforme le
titre central `IT ART STUDIO` en signature persistante. Le même élément reste
au centre pendant le scrub de la vidéo, se compacte sur la fin de la séquence,
puis reste fixé en haut et au centre pendant la lecture des sections suivantes.
Il ne doit exister ni second logo concurrent ni lien « Écrire au studio » dans
le haut de la page.

## Cadrages vidéo

La source validée reste la vidéo 1920×1080 de quatre secondes. Trois modes
visuels partagent exactement la même position temporelle :

- au-dessus de 1100 px, la source complète occupe le viewport ;
- de 761 à 1100 px, deux copies recadrées remplissent les moitiés ART et IT,
  afin de retirer visuellement le vide central et de conserver Carine et Amine ;
- jusqu'à 760 px, une composition 9:16 locale rassemble les deux crops dans
  un seul fichier adapté au viewport vertical.

Tous les médias restent en pause. Le scroll contrôle `currentTime` et ne lance
jamais une lecture autonome. Les éléments non visibles ne sont pas pilotés afin
de limiter le coût de décodage.

## Signature persistante

Le `h1` existant devient `position: fixed`. De 0 à 80 % du scrub, il reste dans
sa composition centrale actuelle. Entre 80 et 100 %, une interpolation par
transform le déplace vers le centre supérieur et réduit son échelle. À 100 %,
il reste compact au-dessus des sections, toujours aligné sur l'axe vertical.
Sous `prefers-reduced-motion`, la vidéo montre sa dernière image et la signature
est directement compacte, sans transition.

## Pleine largeur et lumière

Les sections de contenu, la méthode, le contact et le footer occupent la largeur
complète de la fenêtre. Le padding demeure appliqué aux contenus de chaque
moitié, mais plus aucun `max-width` ne borne les fonds de section. Les halos ART
et IT sont ancrés aux bords du viewport et peuvent se prolonger sans révéler de
bande noire verticale. L'axe central unique reste continu au-dessus des fonds.

## Responsive, accessibilité et performance

Le titre reste lisible sans masquer les liens ou les grands titres lorsqu'il est
compact. Les trois modes sont sélectionnés par media queries, sans débordement
horizontal à 320 px. Les sources MP4 et WebM conservent un poster local. Le
scrub respecte `prefers-reduced-motion`; aucun contenu essentiel ne dépend de
la vidéo ou d'une animation. La QA navigateur mesure le plein écran, la présence
des deux crops sur tablette, le média vertical sur mobile, la synchronisation
temporelle et la persistance réelle du titre après la hero.
