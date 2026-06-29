# Design

## Visual Theme

IT Art Studio utilise une direction "atelier de systemes": une surface graphite,
des panneaux limestone tres calmes, des accents cuivre et signal, et des images
d'artefacts de studio. L'effet recherche est premium, tactile et structure, sans
surcharger la page.

## Color

Tokens principaux en OKLCH:

- `--graphite`: fond sombre, presence studio, hero et valeurs.
- `--surface`: surface claire principale, proche du blanc neutre.
- `--limestone`: surface secondaire froide, utilisee pour les panneaux.
- `--copper`: accent editorial et humain.
- `--signal`: accent technique discret.
- `--moss`: accent secondaire ponctuel.

Le contraste texte/fond doit rester AA. Le texte courant reste sombre sur les
surfaces claires et clair sur graphite.

## Typography

Le site utilise une pile systeme pour eviter les choix de polices trop reflexes:

- UI et corps: `Avenir Next`, `Segoe UI`, `Helvetica Neue`, Arial, sans-serif.
- Display: Georgia, `Times New Roman`, serif.

Les grands titres restent sous `6rem`, avec un tracking minimum de `-0.025em`.
Les paragraphes sont limites par le layout et utilisent `text-wrap: pretty`.

## Layout

La page est une one-page statique composee de grandes sections:

1. Hero image-led avec artefact studio.
2. Positionnement.
3. Deux pratiques.
4. Valeurs.
5. Projets choisis.
6. Methode.
7. Fondateurs.
8. Citation.
9. Contact.

Les cartes sont reservees aux projets et aux fondateurs. Les sections ne sont
pas imbriquees dans des cartes decoratives. Les rayons restent entre 8px et 18px.

## Imagery

L'image source V1 est `/public/assets/studio-artefacts.png`, generee comme un
visuel editorial de table de studio: ordinateur, textile, prototype papier,
detail cuivre et materiel video. Elle sert de hero et de recadrage pour les
projets/fondateurs en attendant des assets reels.

## Motion

Motion minimale: reveal progressif et parallax tres faible. Aucune information
importante ne depend de l'animation. `prefers-reduced-motion` supprime les
transitions et le parallax.

## Components

- `site-header`: navigation sticky compacte.
- `hero`: image-led, H1, lede, CTAs, signaux de credibilite.
- `practice-panel`: deux panneaux asymetriques, primary/secondary.
- `project-card`: image recadree + contexte.
- `method__steps`: sequence ordonnee utile.
- `contact-form`: formulaire statique de qualification, a brancher sur un
  service externe si besoin.
