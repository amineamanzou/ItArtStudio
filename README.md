# IT Art Studio

Site one-page public d'IT Art Studio, studio de conseil et de creation pour
projets exigeants.

La V1 reste un site Astro statique: pas de backend, pas de base de donnees. Le
site est une experience jouable WebGL, servie en fichiers statiques. Le
container final sert les fichiers generes avec Nginx unprivileged sur le port
`8080`, derriere le reverse proxy de l'infra.

## Stack

- Astro en output statique
- CSS sur mesure
- Three.js pour la carte jouable
- Donnees de zones dans `src/game/zones.ts`
- Fallback HTML pour les contextes sans WebGL
- Runtime production `nginxinc/nginx-unprivileged:alpine`

## Commandes locales

```bash
npm ci
npm run dev
npm run assets:validate
npm run check
npm run build
npm run qa:game
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

- `src/pages/index.astro` : shell HTML de l'experience jouable
- `src/layouts/BaseLayout.astro` : layout HTML, SEO de base, runtime client
- `src/game/game.ts` : moteur Three.js leger, deplacement et interactions
- `src/game/asset-loader.ts` : loader GLB asset-first, URLs compatibles Pages,
  preview runtime et couche map opt-in
- `src/game/procedural-assets.ts` : landmarks 3D proceduraux par zone
- `src/game/zones.ts` : contenu editorial de la cartographie
- `src/styles/global.css` : design system, HUD, carte, mobile et fallback
- `assets/world-assets.manifest.json` : bibliotheque GLB/glTF candidate et
  acceptee, textures, licences, budgets et roles narratifs
- `public/assets/models` : modeles runtime acceptes par le manifest
- `public/assets/textures` : futures textures runtime optimisees
- `scripts/validate-asset-library.mjs` : validation de la bibliotheque
  asset-first
- `qa/README.md` : protocole QA Playwright avec screenshots et rapport
- `PRODUCT.md` : contexte strategique pour agents et design
- `DESIGN.md` : systeme visuel courant

Les documents de strategie historiques restent dans `docs/` en local et sont
ignores par Git.
