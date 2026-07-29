# Runtime Models

External GLB/glTF files go here only after they are accepted in
`assets/world-assets.manifest.json`.

Do not drop random downloads in this folder. Every model needs:

- manifest entry;
- source URL;
- license;
- file size;
- triangle count;
- fallback;
- target zone or terrain role.

Current accepted vendor roots:

- `vendor/kenney/city-kit-roads`: CC0 road, bridge support, light and slope
  pieces.
- `vendor/kenney/nature-kit`: CC0 bridge, water, relief and vegetation pieces.

Current accepted local roots:

- `local/itart-signature-kit/hero`: project-authored GLB signatures for Cloud
  Dock, Design Atelier and Observability Tower.
- `local/itart-signature-kit/environment`: project-authored GLB environment
  furniture for the three hero locations.
