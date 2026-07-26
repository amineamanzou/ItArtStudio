# Runtime Textures

Optimized texture files go here after curation.

Use web-sized exports, normally 1K or lower, and keep the original source URL in
`assets/world-assets.manifest.json`. Texture sets should be color-graded toward
the IT Art Studio palette before integration so the map does not become a mix of
unrelated libraries.

## Runtime Map Set

`map/` contains the first accepted lightweight texture vocabulary for the
enlarged map:

- `road`: dark asphalt/hard-surface route material;
- `field`: authored green ground grain for vegetation districts;
- `water`: stylized water edge/foam material;
- `relief`: contour/rock material for cliffs and height changes.

These files are SVG source textures so they stay tiny, editable, and color
coherent while the GLB map layer is still opt-in.
