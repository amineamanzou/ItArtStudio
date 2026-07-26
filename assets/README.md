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
