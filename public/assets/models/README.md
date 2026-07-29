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
- `vendor/kenney/factory-kit`: CC0 industrial, platform, pipe, machine, screen
  and work-surface pieces.

Forbidden runtime roots:

- `local/itart-signature-kit`: removed after the V10.2 direction change. Do
  not reintroduce generated local GLB in accepted or integrated runtime assets.
