# IT Art Studio

Site vitrine public d'IT Art Studio, société de conseil et de création réunissant
une pratique informatique et une pratique visuelle.

La version de production est volontairement statique : HTML et CSS générés par
Astro, images optimisées, aucun JavaScript côté client, aucun formulaire, cookie
de mesure d'audience ou traceur.

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
tablette et mobile, vérifie les images, les liens publics, les erreurs navigateur
et les débordements horizontaux. Les captures sont écrites dans
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
- `src/styles/global.css` : direction visuelle responsive
- `public/assets/hero-*` : visuels optimisés et fallbacks
- `scripts/review-static-source.mjs` : contrat des sources
- `scripts/review-static-site.mjs` : contrat du build
- `scripts/qa-static.mjs` : QA navigateur responsive

L'ancienne expérience WebGL reste conservée dans la branche
`codex/interactive-world-v10-archive` pour une reprise ultérieure.
