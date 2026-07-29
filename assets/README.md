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

Hard rule:

- Runtime model collections must come from downloaded asset libraries. The old
  `local/itart-signature-kit` generated GLB path is forbidden in accepted,
  integrated, preview, core, and map runtime proofs.

Accepted runtime packs:

- `public/assets/models/vendor/kenney/city-kit-roads/roads`: 9 GLB road
  pieces for the future enlarged road grammar.
- `public/assets/models/vendor/kenney/city-kit-roads/route-edge`: 6 GLB route
  edge props plus the pack colormap texture.
- `public/assets/models/vendor/kenney/nature-kit/bridges`: 6 GLB bridge/plank
  pieces for water crossings.
- `public/assets/models/vendor/kenney/nature-kit/relief`: 18 GLB cliff and rock
  pieces for heightfield accents.
- `public/assets/models/vendor/kenney/nature-kit/water`: 8 GLB river/water-edge
  pieces for authored water transitions.
- `public/assets/models/vendor/kenney/nature-kit/vegetation`: 19 GLB trees,
  bushes and ground details for sparse, instanced vegetation.
- `public/assets/models/vendor/kenney/factory-kit/industrial`: 23 GLB
  industrial, screen, pipe, platform and work-surface pieces for Cloud Dock,
  Design Atelier and Observability Tower proofs.
- `public/assets/textures/vendor/polyhaven`: CC0 terrain texture set used by
  the public asset-only shader, including brown muddy leaf litter, grass-path
  compacted earth, stony dirt fallback, rocky relief and low-tide shore
  materials.
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
- The Factory Kit integration is an accelerator, not the final premium library:
  it now carries the three hero locations until stronger downloaded packs are
  curated.
- `?assets=preview` must load only downloaded vendor specimens, so accepted
  models are proven as a library before they are judged inside the full map
  composition.

Map expansion kits:

- `mapExpansionKits` are the contract between the library and the next larger
  map. New GLB/glTF or texture work should enrich one of these kits before it is
  placed in the world.
- Each kit must bind terrain roles to accepted model collections, accepted map
  textures, runtime fallback behavior, placement/coverage thresholds and a
  noise budget. This keeps the expansion asset-first instead of prop-first.

Public terrain-first runtime:

- `publicTerrainCore` is the stricter public contract for `?world=asset-only`.
  It must prove a downloaded GLB vehicle, downloaded terrain textures, visible
  center wetland assets, four outer edge screenshots, and zero generated
  runtime scenery counters.
- The public vehicle proof is semantic, not only dimensional: `race.glb` must
  expose the downloaded Kenney mesh names `body` plus four `wheel-*` meshes in
  the runtime QA snapshot.
- V13.8 keeps the 112-unit shell and proves 174 public placements across
  roughly 105x105 units of coverage. It adds a spawn clearing with an integrated
  terrain-water mask plus downloaded reeds, lily, boardwalk, rocks, grass and a
  tree so the first viewport reads as terrain rather than only textured ground.
  The public terrain shader now uses the downloaded `grass_path_2` texture for
  routes, tinted down into the dark theme, so paths read as compacted natural
  ground instead of gray road plates or tire-like marks. The edge placements
  deliberately avoid road/path plates and block-like cliff chunks; downloaded
  bridges are kept only where they read as water crossings. QA now records
  material coverage ratios for field, path, water and relief so a public map
  cannot pass by merely loading textures without a spatially readable terrain.

Core promotion:

- `corePromotion` is the contract for moving the best downloaded anchors from
  opt-in inspection into the public `core` runtime.
- V10.2 promotes one vendor Factory Kit anchor per hero location:
  `machine-fortified.glb`, `top-large-checkerboard.glb`, and
  `screen-wide.glb`.
- Promotion is manifest-driven: the loader reads `requiredPlacementIds`, while
  QA proves the files, placements, hero roles, public paths and screen-space
  rectangles before the change is considered public-ready.
