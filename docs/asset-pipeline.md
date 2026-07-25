# Asset Pipeline

## Goal

The next art direction pass must replace noisy procedural filler with themed 3D
places. Assets are introduced only when they make a location more readable,
reduce generic decoration, and stay within QA budgets.

## Candidate Sources

- Khronos glTF Sample Assets: validation references and known-good GLB/glTF
  fixtures. Licenses vary per model and must be checked per asset.
- Three.js asset catalogs: small web-ready GLB assets for clouds, roads,
  buildings and environment props. Validate license and download provenance
  before vendoring.
- CC0/PBR texture libraries: use small, optimized maps through a Three.js
  loader or a local texture manifest. Avoid runtime zip downloads.
- Quaternius / Poly Pizza / Poly Haven: useful for low-poly props, office
  objects, city pieces and neutral environment assets. Prefer CC0 where
  available; otherwise record attribution.
- Blender procedural exports: use for bespoke zone props when no sourced asset
  matches the theme, then export optimized GLB.

## Manifest Contract

Every imported asset needs:

- `id`
- `sourceUrl`
- `license`
- `attribution`
- `zoneId`
- `narrativeRole`
- `fallbackFactory`
- `maxCompressedKb`
- `maxMeshCount`
- `maxMaterialCount`
- `qaProof`

## First Targets

- `cloud-dock`: cloud puffs, server racks, electric arcs.
- `design-atelier`: garment workshop, mannequin, fabric table, hanging pattern.
- `contact-portal`: post office desk, mail sorting boxes, envelopes, stamps.
- `observability-tower`: antenna rig, trace screens, signal rings.

## Acceptance

- The asset must be visible in a zone close-up screenshot.
- The asset must not introduce z-fighting or texture shimmer.
- The asset must not push the scene over the current object budget without an
  offsetting optimization.
- The asset must have a procedural fallback for loading failures and reduced
  test fixtures.
