# Design

## Visual Theme

IT Art Studio utilise maintenant une direction cinematic dark: une scene noire
travaillee par un split central IT / ART, des particules WebGL sur desktop, une
image d'atelier assombrie et une frontiere lumineuse ou `STUDIO` sert de
passage. Le site doit se lire comme une sequence en scroll, avec peu de
composants visibles et une forte impression de mouvement.

## Color

Tokens principaux en OKLCH:

- `--void`: fond noir principal.
- `--tech`: accent cyan du cote IT.
- `--art`: accent corail du cote ART.
- `--studio`: blanc chaud pour le point commun et les CTAs.
- `--glass`: surfaces translucides pour navigation, liens et contact.

Le contraste texte/fond doit rester AA. Les accents ne portent pas seuls une
information critique.

## Typography

Le site garde une pile systeme pour rester rapide et eviter les choix de polices
trop reflexes:

- UI et corps: `Avenir Next`, `Segoe UI`, `Helvetica Neue`, Arial, sans-serif.
- Display ponctuel: `Bodoni 72`, Didot, `Times New Roman`, serif.

Le hero reserve la serif a `STUDIO` et au CTA final. Les mots IT / ART restent
plus directs, proches de la frontiere centrale.

## Layout

La page est une one-page statique composee de scenes:

1. Hero split IT / ART proche de la frontiere, avec `STUDIO` en dessous.
2. Founder reveal avec abstractions temporaires pour tester le mouvement de tete.
3. Pont de reseaux sociaux cliquables avec carrousel de videos en background,
   pret a recevoir les assets reels des reseaux.
4. Domain split plus ouvert: IA, observabilite, architecture, scaling, cloud a
   gauche; design, 3D, collection, image et matiere a droite.
5. Valeurs communes en trois lignes horizontales, vitesses opposees et
   differentes.
6. Contact final en texte pur, avec surbrillance au hover.

Le split simultane est reserve au desktop. Sur mobile, un switch fixe IT /
Studio / Art sert de repere et le contenu reste empile, lisible et stable.

## Imagery

L'image source V1 `/public/assets/studio-artefacts.png` reste la matiere de
fond. Les portraits fondateurs sont volontairement abstraits dans ce prototype:
ils servent a tester le timing et l'alignement avant de consommer des credits de
generation video ou de produire des portraits definitifs.

## Motion

La motion est une amelioration progressive:

- GSAP ScrollTrigger pour pin/scrub du hero et transitions de sections.
- Lenis pour le scroll lisse.
- Three.js pour les particules et le motif central sur desktop seulement.
- `prefers-reduced-motion` supprime le runtime lourd et garde un recit statique.
- Les ancres sont recalculees apres `ScrollTrigger.refresh()` pour tenir compte
  du pinning et de la navigation fixe.

Aucune information importante ne depend de l'animation: le contenu reste present
par defaut.

## Components

- `cinematic-nav`: navigation fixe compacte.
- `hero-cinematic`: split principal, canvas WebGL, marque centrale.
- `founder-reveal`: scene de test pour les futurs portraits.
- `social-bridge`: liens reseaux.
- `domain-split`: deux colonnes IT / ART.
- `shared-values`: valeurs transverses.
- `contact-final`: CTA mailto.
