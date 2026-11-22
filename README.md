# IT Art Studio

Site vitrine public d'IT Art Studio, société de conseil et de création réunissant
une pratique informatique et une pratique visuelle.

La version de production est volontairement statique : HTML et CSS générés par
Astro, images optimisées, un seul petit script inline pour la signature et les
apparitions, aucun formulaire, cookie de mesure d'audience ou traceur. La
composition de la hero est animée en CSS et ne charge aucune vidéo.

## Stack

- Astro en sortie statique
- CSS sur mesure et polices locales
- images AVIF, WebP et JPEG avec fallback
- Caddy non privilégié sur le port `8080`
- image publiée sur GHCR puis déployée par le runtime Argo partagé

## Commandes locales

```bash
npm ci
npm run dev
npm run check
npm run build
npm run qa:static
npm run preview
```

`npm run qa:static` contrôle la home et les mentions légales en desktop,
tablette et mobile jusqu'à 320 px, vérifie les images, les liens publics, les
erreurs navigateur et les débordements horizontaux, ainsi que la hero : deux
moitiés égales, animation sans interaction, composition figée en mouvement
réduit, absence de requête vidéo, défilement et navigation au clavier. Les captures sont écrites dans
`qa/artifacts/static/`.

## Container

```bash
docker build -t it-art-studio .
docker run --rm -p 8080:8080 it-art-studio
```

Puis ouvrir `http://127.0.0.1:8080/`. La sonde de santé répond sur
`http://127.0.0.1:8080/healthz`.

## Structure active

- `src/pages/index.astro` : vitrine split IT / ART
- `src/pages/mentions-legales.astro` : informations légales de la SARL
- `src/data/site.ts` : contenu public et données société
- `src/layouts/BaseLayout.astro` : structure, navigation et métadonnées SEO
- `src/data/hero-field.ts` : géométrie des strates ART / IT de la hero
- `src/scripts/hero-scroll.ts` : signature épinglée et pause hors écran
- `src/styles/global.css` : direction visuelle responsive et animation de la hero
- `public/assets/hero-*` : visuels optimisés, dont l'image de partage
- `scripts/review-static-source.mjs` : contrat des sources
- `scripts/review-static-site.mjs` : contrat du build
- `scripts/qa-static.mjs` : QA navigateur responsive

L'ancienne expérience WebGL reste conservée dans la branche
`codex/interactive-world-v10-archive` pour une reprise ultérieure.
