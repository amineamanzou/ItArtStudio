# Kenney Terrain Priority Inventory

Generated: 2026-07-29T22:51:38.625Z

This is a quarantine inventory only. Nothing listed here is allowed in the public runtime until it is copied into `public/assets`, declared in `world-assets.manifest.json`, budgeted, and proven by QA.

## Summary

- Packs: 2
- GLB files: 62
- Candidate terrain assets: 12
- Held for manual review: 7
- Rejected for public terrain: 43
- Total GLB weight: 6908.1 KB
- Total GLB triangles: 69319

## kenney-mini-forest

- Backlog: `source-kenney-mini-forest-non-conic-vegetation`
- Source: https://kenney.nl/assets/mini-forest
- License: CC0-1.0
- Archive SHA-256: `8691614018075a66458e35915b8c358c2e6178648aedadafcdf313b924aa6581`
- GLB files: 22
- Candidates/Hold/Reject: 8/4/10

| Decision | Name | Roles | KB | Triangles | Review Focus |
|---|---|---:|---:|---:|---|
| candidate | bridge | bridge | 31.7 | 372 | usable crossing; not a flat plate; compatible scale with current vehicle |
| hold | building-platform | path | 47.1 | 508 | flat plate risk; may read as generated rectangle; use texture layer first |
| reject-public-terrain | building-roof | n/a | 31.2 | 324 | not a terrain-first asset; keep out of public terrain core |
| reject-public-terrain | building-structure | n/a | 16 | 144 | not a terrain-first asset; keep out of public terrain core |
| reject-public-terrain | character-archer | n/a | 233.5 | 574 | not a terrain-first asset; keep out of public terrain core |
| reject-public-terrain | fence | n/a | 29.2 | 330 | not a terrain-first asset; keep out of public terrain core |
| reject-public-terrain | flag | n/a | 16.2 | 162 | not a terrain-first asset; keep out of public terrain core |
| reject-public-terrain | ladder | n/a | 21.7 | 216 | not a terrain-first asset; keep out of public terrain core |
| hold | patch-dirt | path | 9.9 | 108 | flat plate risk; may read as generated rectangle; use texture layer first |
| hold | patch-grass | path | 29 | 295 | flat plate risk; may read as generated rectangle; use texture layer first |
| candidate | plant | vegetation | 21.9 | 156 | non-conic silhouette; reads as vegetation at distance; fits current low-poly vendor palette |
| hold | platform | path | 61.9 | 651 | flat plate risk; may read as generated rectangle; use texture layer first |
| candidate | rocks-high | relief | 31.2 | 342 | authored relief silhouette; no primitive block read; useful near water or map edge |
| candidate | rocks-low | relief | 31.2 | 342 | authored relief silhouette; no primitive block read; useful near water or map edge |
| candidate | rocks-ramp | relief | 22.6 | 234 | authored relief silhouette; no primitive block read; useful near water or map edge |
| candidate | stones | relief | 22.6 | 236 | authored relief silhouette; no primitive block read; useful near water or map edge |
| reject-public-terrain | target | n/a | 17.3 | 188 | not a terrain-first asset; keep out of public terrain core |
| reject-public-terrain | tent | n/a | 76.1 | 847 | not a terrain-first asset; keep out of public terrain core |
| candidate | tree-high | vegetation | 30.4 | 266 | non-conic silhouette; reads as vegetation at distance; fits current low-poly vendor palette |
| candidate | tree | vegetation | 22.9 | 182 | non-conic silhouette; reads as vegetation at distance; fits current low-poly vendor palette |
| reject-public-terrain | weapon-arrow | n/a | 7 | 58 | not a terrain-first asset; keep out of public terrain core |
| reject-public-terrain | weapon-bow | n/a | 8.3 | 80 | not a terrain-first asset; keep out of public terrain core |

## kenney-modular-cave-kit

- Backlog: `source-kenney-modular-cave-relief`
- Source: https://kenney.nl/assets/modular-cave-kit
- License: CC0-1.0
- Archive SHA-256: `48f37a6d4f241124cd7da17da1c6d4ed1bf1820bb149dcb233fbd5ebdd8ba996`
- GLB files: 40
- Candidates/Hold/Reject: 4/3/33

| Decision | Name | Roles | KB | Triangles | Review Focus |
|---|---|---:|---:|---:|---|
| reject-public-terrain | corridor-corner | relief | 65 | 624 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-end | relief | 125.9 | 1324 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-intersection | relief | 23.9 | 244 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-junction | relief | 54.3 | 564 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-transition | relief | 214.3 | 2276 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-wide-corner | relief | 148.8 | 1516 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-wide-end | relief | 228 | 2428 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-wide-intersection | relief | 25.1 | 256 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-wide-junction | relief | 89.1 | 940 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor-wide | relief | 153 | 1624 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | corridor | relief | 84.5 | 884 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| hold | gate-metal-bars | n/a | 66.6 | 720 | inspect manually before any public use |
| candidate | gate-overhang | relief | 9.9 | 104 | authored elevation break; not a primitive wall; use away from hero bases first |
| candidate | gate-rock | relief | 31 | 360 | authored elevation break; not a primitive wall; use away from hero bases first |
| hold | gate | n/a | 52.5 | 592 | inspect manually before any public use |
| hold | ladder | bridge | 16.9 | 160 | scale risk; could become route punctuation later; not terrain-first enough yet |
| reject-public-terrain | room-corner | relief | 354.5 | 3612 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | room-large-variation | relief | 773.2 | 7956 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | room-large | relief | 786.1 | 8080 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | room-small-variation | relief | 376.7 | 3868 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | room-small | relief | 338.4 | 3356 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | room-wide-variation | relief | 650.9 | 6704 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | room-wide | relief | 537.5 | 5460 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| candidate | stairs-wide | relief | 231.9 | 2506 | authored elevation break; not a primitive wall; use away from hero bases first |
| candidate | stairs | relief | 222.6 | 2386 | authored elevation break; not a primitive wall; use away from hero bases first |
| reject-public-terrain | template-corner | relief | 59.6 | 564 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-detail | relief | 31.9 | 320 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-floor-big | relief | 63.3 | 636 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-floor-detail-a | relief | 22.1 | 204 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-floor-detail | relief | 22.1 | 204 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-floor-layer-hole | relief | 40.1 | 384 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-floor-layer-raised | relief | 32.9 | 312 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-floor-layer | relief | 18.6 | 168 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-floor | relief | 2 | 4 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-wall-corner | relief | 7 | 60 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-wall-detail-a | relief | 41 | 420 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-wall-half | relief | 19.5 | 192 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-wall-stairs | relief | 10.6 | 104 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-wall-top | relief | 15 | 148 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |
| reject-public-terrain | template-wall | relief | 42.9 | 440 | wall or floor tile risk; could read as primitive block/plate; needs separate cave biome proof |

