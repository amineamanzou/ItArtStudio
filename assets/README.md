# Asset Library

This folder is the curation layer for the asset-first roadmap.

`world-assets.manifest.json` is the source of truth for external GLB/glTF
models, texture sets, licenses, budgets, narrative roles, and integration
status.

Status flow:

- `candidate`: researched source or pack, not downloaded yet.
- `accepted`: downloaded locally, budgeted, licensed, but not rendered in the
  world yet.
- `integrated`: loaded by the runtime and proven by QA.
- `rejected`: explicitly not suitable for style, license, weight, or quality.

Production rules:

- Prefer CC0 assets for all production scenery.
- Keep CC-BY assets for pipeline/importer tests unless attribution UI is added.
- No accepted model without local file, file weight, triangle count, source,
  license, role, and fallback.
- No integrated model without a QA proof reference.
- Textures must be downsampled and color-graded before production use.

Run:

```bash
npm run assets:validate
```

Regenerate local signature GLB assets:

```bash
npm run assets:generate-signature
```

Accepted runtime packs:

- `public/assets/models/vendor/kenney/city-kit-roads/roads`: 9 GLB road
  pieces for the future enlarged road grammar.
- `public/assets/models/vendor/kenney/city-kit-roads/route-edge`: 6 GLB route
  edge props plus the pack colormap texture.
- `public/assets/models/vendor/kenney/nature-kit/bridges`: 6 GLB bridge/plank
  pieces for water crossings.
- `public/assets/models/vendor/kenney/nature-kit/relief`: 8 GLB cliff and rock
  pieces for heightfield accents.
- `public/assets/models/vendor/kenney/nature-kit/water`: 8 GLB river/water-edge
  pieces for authored water transitions.
- `public/assets/models/vendor/kenney/nature-kit/vegetation`: 10 GLB trees,
  bushes and ground details for sparse, instanced vegetation.
- `public/assets/models/vendor/kenney/factory-kit/industrial`: 23 GLB
  industrial, screen, pipe, platform and work-surface pieces for Cloud Dock,
  Design Atelier and Observability Tower proofs.
- `public/assets/models/local/itart-signature-kit/hero`: 9 generated GLB
  signature anchors across the three hero locations: server/cloud node, cloud
  bridge, energy anchor, mannequin/fabric rack, drape frame, pattern wall,
  telemetry mast, screen array and trace beacon.
- `public/assets/models/local/itart-signature-kit/environment`: 3 generated GLB
  environment pieces, one per hero location: cloud server pier, atelier cutting
  island and observability trace station.
- `public/assets/models/local/itart-signature-kit/premium`: 3 generated V9.3
  GLB silhouettes, one per hero location: cloud infra gateway, atelier garment
  loom and observability signal spire.
- `public/assets/models/local/itart-signature-kit/detail`: 3 generated V9.9
  secondary detail GLB pieces, one per hero location: cloud cable manifold,
  atelier swatch stand and observability log totem.
- `public/assets/models/local/itart-signature-kit/terrain`: 3 generated V10.0
  terrain transition GLB pieces for route/water, route/relief and field-marker
  seams before the next sparse map expansion.
- `public/assets/textures/map/hero`: 3 SVG runtime texture pads for Cloud Dock,
  Design Atelier and Observability Tower.

The validator derives local file weight and triangle counts from the GLB files
and refuses accepted entries when the manifest drifts from the runtime folders.

Hero-location curation:

- Each hero location must keep a `heroLocationCuration` contract in the
  manifest.
- The contract names a visual signature, accepted asset collections, at least
  six visual roles, a minimum runtime placement count, and the next custom asset
  gap.
- The Factory Kit integration is an accelerator, not the final premium library.
  The local signature kit fills the first recognisable-silhouette gap enough for
  visual QA: three anchors per hero location, one authored environment
  furniture piece per hero location and one V9.3 premium silhouette per hero
  location in the `?assets=map` inspection layer.
- The local kit is generated from `scripts/generate-signature-assets.mjs`, then
  declared in the manifest like any other accepted runtime collection. Future
  Blender assets should replace these generated silhouettes once their visual
  direction is proven.
- `?assets=preview` must load both the terrain/vendor specimens and the local
  premium silhouettes, so accepted models are proven as a library before they
  are judged inside the full map composition.

Map expansion kits:

- `mapExpansionKits` are the contract between the library and the next larger
  map. New GLB/glTF or texture work should enrich one of these kits before it is
  placed in the world.
- Each kit must bind terrain roles to accepted model collections, accepted map
  textures, runtime fallback behavior, placement/coverage thresholds and a
  noise budget. This keeps the expansion asset-first instead of prop-first.

Core promotion:

- `corePromotion` is the contract for moving premium anchors from opt-in
  inspection into the public `core` runtime.
- V9.6 promotes exactly one premium GLB per hero location:
  `cloud-infra-gateway.glb`, `atelier-garment-loom.glb`, and
  `observability-signal-spire.glb`.
- Promotion is manifest-driven: the loader reads `requiredPlacementIds`, while
  QA proves the premium files, placements, hero roles, public paths and
  screen-space rectangles before the change is considered public-ready.
