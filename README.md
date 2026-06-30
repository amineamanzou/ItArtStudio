# IT Art Studio

Site one-page public d'IT Art Studio, studio de conseil et de creation pour
projets exigeants.

La V1 reste un site Astro statique: pas de backend, pas de base de donnees, pas
de SPA. Le container final sert les fichiers generes avec Nginx unprivileged sur
le port `8080`, derriere le reverse proxy de l'infra.

## Stack

- Astro en output statique
- CSS sur mesure
- GSAP ScrollTrigger pour la narration au scroll
- Lenis pour le scroll lisse
- Three.js pour la scene WebGL du split IT / ART
- Image editoriale locale dans `public/assets/`
- Runtime production `nginxinc/nginx-unprivileged:alpine`

## Commandes locales

```bash
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

## Container

```bash
docker build -t it-art-studio .
docker run --rm -p 8080:8080 it-art-studio
```

Puis ouvrir `http://127.0.0.1:8080/`.

## CI

Le workflow GitHub Actions `.github/workflows/ci.yml` lance:

- `npm ci`
- `npm run check`
- `npm run build`
- upload de `dist`
- build Docker
- smoke test HTTP du container sur `8080`

## Preview GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie la version statique sur
GitHub Pages pour previsualisation:

`https://amineamanzou.github.io/ItArtStudio/`

Avant la premiere publication, ouvrir les settings du repository sur GitHub,
aller dans **Pages**, puis choisir **GitHub Actions** comme source. Le workflow
se lance a chaque push sur `main` et peut aussi etre lance manuellement depuis
l'onglet **Actions**.

## Structure

- `src/pages/index.astro` : contenu de la one-page cinematic
- `src/layouts/BaseLayout.astro` : layout HTML, SEO de base, runtime client
- `src/scripts/cinematic.ts` : GSAP, Lenis, Three.js et switch mobile
- `src/styles/global.css` : design system, scenes, responsive
- `public/assets/studio-artefacts.png` : visuel hero/projets V1
- `PRODUCT.md` : contexte strategique pour agents et design
- `DESIGN.md` : systeme visuel courant

Les documents de strategie historiques restent dans `docs/` en local et sont
ignores par Git.
