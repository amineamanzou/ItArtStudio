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

The validator derives local file weight and triangle counts from the GLB files
and refuses accepted entries when the manifest drifts from the runtime folders.

Hero-location curation:

- Each hero location must keep a `heroLocationCuration` contract in the
  manifest.
- The contract names a visual signature, accepted asset collections, at least
  six visual roles, a minimum runtime placement count, and the next custom asset
  gap.
- The current Factory Kit integration is an accelerator, not the final premium
  library: Design Atelier still needs a dedicated mannequin/fabric rack, Cloud
  Dock needs a clearer server/cloud silhouette, and Observability Tower needs a
  stronger antenna/radar mast.
