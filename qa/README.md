# IT Art Studio QA Protocol

This folder defines the interactive QA gate for the 3D brand experience.
Generated artifacts are written to `qa/artifacts/` and ignored by Git.

## Command

```bash
npm run qa:game
```

For tighter local loops:

```bash
npm run qa:game:quick
```

By default the runner uses `http://127.0.0.1:4331/?qa=1` so it can run next
to a normal Astro dev server on `4321`. Override it with `QA_PORT` or
`QA_BASE_URL` when needed.

`qa:game` is the full pre-push gate. `qa:game:quick` keeps the same critical
WebGL, color, world-richness, keyboard, contact, sampled mini-map, desktop,
mobile, and reduced-motion checks while skipping the exhaustive breakpoint and
all-pin traversal.

The runner:

- starts the local Astro dev server;
- opens Chromium through Playwright;
- waits for `html.game-ready` and `window.__IT_ART_STUDIO_QA__`;
- verifies that the WebGL canvas renders non-dark pixels;
- verifies that the WebGL canvas is a visible full-screen surface;
- verifies that the page exposes the `IT / ART / STUDIO` identity through
  visible DOM typography and distinct colors;
- gates every screenshot on visible canvas detail, edge transitions, and color
  buckets;
- verifies that the rendered canvas exposes tech, art, and studio color families;
- verifies that the world exposes enough 3D cartography assets, per-zone
  landmark inventory, and playable avatar parts;
- opens opt-in GLB URLs for the asset-first pipeline: `?assets=preview` proves
  accepted files load, while `?assets=map` proves the accepted terrain
  vocabulary can form a route/water/relief/vegetation composition across the
  map before it is promoted to the public runtime;
- verifies that every `ZoneVisualSpec` is materialized in the rendered scene
  graph with decals, prop clusters, prop objects, material variants, and a
  distinct visual fingerprint;
- verifies that every declared zone surface profile is materialized with finish,
  motif, roles, signatures, and non-duplicated surface fingerprints;
- verifies that route guidance is derived from the road graph and materializes
  every drive segment with visible chevrons and studs;
- verifies that the road graph exposes lightweight route encounter gates and
  that the real keyboard route triggers discovery moments across studio, tech,
  and art routes;
- verifies that the visible UI leaves the playable 3D stage dominant across
  desktop, tablet, mobile, and reduced-motion viewports;
- verifies that a real keyboard route can drive into an active route encounter
  that is visible on screen together with a readable rover;
- verifies that the scene graph keeps enough object-count headroom for future
  modeled assets while preserving route guidance semantics;
- verifies that prop clusters are rendered as instanced batches while preserving
  the declared semantic prop count and perceptual zone evidence;
- verifies that rendered visual specs expose motion roles for biome-specific
  animation;
- verifies that every zone exposes multiple local motion behaviors so the world
  reads as alive instead of globally rotating;
- verifies that every zone exposes narrative set dressing objects, role names,
  and distinct signatures;
- verifies that every zone exposes dedicated procedural signature artifacts with
  unique signatures, roles, and material variants distinct from generic set
  dressing;
- verifies that the active zone's signature artifact projects to a readable
  screen rectangle, remains visible after UI occlusion, and exposes a local
  pixel ROI with enough brightness, edge transitions, and color buckets;
- reuses that signature artifact visibility proof after mini-map jumps so the
  wider cartography is validated, not only the real keyboard route;
- verifies that the active landmark, place architecture, and signature artifact
  are visible together as a readable screen-space composition, with bounded UI
  occlusion, coherent center spread, reported layer overlap, and a local ROI on
  the composition union;
- aggregates place-composition proofs across the sampled mini-map zones so quick
  mode covers four representative zones and full mode covers all ten zones;
- verifies that the global world composition exposes terrain layers, route
  lights, district silhouettes, studio thresholds, and animated scenery roles;
- verifies that keyboard and mini-map zone changes trigger visible 3D
  activation feedback with rings, sparks, opacity, scale, and sequence telemetry;
- records frame telemetry before gameplay scenarios;
- measures a live runtime budget from the game's frame counter before
  screenshot sampling so WebGL stalls from pixel reads do not hide low FPS;
- drives the player with keyboard input through tech, art, and contact zones;
- verifies that the rover leaves visible trail feedback after a played route;
- runs one real `page.keyboard.press()` smoke test against the production
  keyboard listener;
- opens an isolated `?qa=1&realKeys=1` page for each directional proof and
  verifies vehicle controls with real `keyboard.down/up` events: forward and
  backward produce movement in the rover axis, left and right rotate the rover
  without requiring lateral strafing, and every proof records frame deltas and
  input counters;
- uses the `?qa=1` keyboard-step hook to keep navigation deterministic in
  headless Chromium while preserving `lastInputMode: keyboard`;
- opens a separate `?qa=1&realKeys=1` page where the deterministic keyboard
  hook is absent, then plays a fixed open-loop keyboard tape with no waypoint
  decisions derived from player position;
- verifies arcade driving telemetry for that tape: acceleration, braking,
  left/right steering while moving, lateral drift, coast/drag recovery,
  route/off-route samples, route encounter intensity, camera stability, trail
  feedback, and normalized per-frame displacement;
- keeps waypoint-style driving as an assisted diagnostic only; it is not the
  primary proof of real keyboard driving;
- opens the production URL without `?qa=1` and verifies that the game reaches
  `game-ready` without exposing the heavy QA snapshot, deterministic step hook,
  or explicit QA refresh hook;
- projects the rover and active zone into screen coordinates, then checks that
  they stay readable and outside visible HUD, panel, mini-map, and mobile
  controls;
- projects the central `IT / STUDIO / ART` identity ribbon into screen
  coordinates and samples it across multiple frames so the QA proves a living
  3D brand asset, not only a scene-graph entry;
- clicks mini-map buttons with real pointer coordinates after a DOM hit-test and
  verifies active zone state, `aria-pressed`, pointer input mode, and player
  marker convergence;
- taps mobile zone navigation and holds the mobile drive control through real
  pointer coordinates after a DOM hit-test;
- runs responsive captures for desktop, tablet, mobile, and small mobile in
  full mode;
- runs a reduced-motion viewport;
- checks that the contact CTA becomes a visible `mailto:` link;
- captures screenshots for every major QA state;
- checks HUD, panel, mini-map, mobile nav, and controls for overlap;
- checks UI coverage, visible text overflow, and 44px mobile tap targets;
- checks the playable stage coverage with the real visible chrome
  (brand/status/contact, intro, panel, mini-map, mobile nav, and drive controls)
  and verifies the contact CTA remains directly actionable when present;
- reports total duration, active zone, canvas dimensions, frame timing, visual
  detail, and 3D inventory so slow or shallow QA loops are visible;
- writes `report.json`, `report.md`, and screenshots under `qa/artifacts/`.

## Current Gates

- Canvas must be non-blank.
- Canvas must expose visible tech, art, and studio color families.
- Every screenshot capture must pass visible detail gates.
- World richness must report at least 10 zones, 18 road segments, 45 decorative
  objects, 225 scene objects, and 135 landmark objects.
- `external-asset-preview-runtime` must load nine accepted GLB specimens: six
  terrain/vendor files plus the three local premium hero-location silhouettes,
  with GitHub Pages-safe `vendor/` and `local/` URLs.
- `map-expansion-kits-manifest` must prove that the manifest declares route,
  water/relief, vegetation/field, and hero-location kits before the map grows.
  Together the kits must cover `bridge`, `hero-location`, `relief`, `road`,
  `route-edge`, `vegetation`, and `water`, with at least 83 planned runtime
  placements, 18 unique files, accepted texture bindings, fallbacks, coverage
  thresholds, and noise budgets.
- `core-promotion-contract` must prove that `corePromotion` promotes exactly
  one premium GLB anchor per hero location into the public `core` runtime,
  with manifest-bound files, placement ids, hero roles, coverage, density and
  fallback rules.
- `external-asset-core-premium-runtime` must prove that the three premium
  anchors are not merely declared: their files, placement ids, public paths and
  per-file/per-placement screen rectangles must be visible in the public core
  runtime without asset load failures.
- `external-asset-map-composition` must load an opt-in map layer with at least
  the manifest kit placement budget, 18 unique GLB files, 8 clusters, all seven
  visual terrain roles, route, water, relief and vegetation linkage,
  primary/support/context curation, promotion candidates, bounded cluster
  density, measured bounding-box ground clearance, no coplanar placement risk,
  visible screen-space role rectangles for route/water/relief/vegetation, and a
  wide non-flat canvas proof covering at least a `70x70` map vocabulary
  footprint.
- The same opt-in map layer must also prove the first hero-location GLB
  composition pass: `cloud-dock`, `design-atelier`, and
  `observability-tower` each need manifest-derived runtime placements, required
  visual roles, and a dedicated mini-map screenshot where the GLB cluster is
  screen-visible.
- `assets:validate` must also prove accepted runtime texture coverage for the
  core enlarged-map material roles: road, water, relief, and vegetation/field.
- Every zone must expose a label, modeled landmark objects, mesh count, and
  minimum 3D bounds.
- Every zone must expose one rendered visual spec, at least three decals, three
  prop clusters, nine prop objects, six material variants, and a distinct
  fingerprint. The rendered counts must also meet or exceed the expectations
  derived from that zone's spec.
- Every zone must expose one rendered surface profile, at least five surface
  objects, five surface signatures, four surface roles, and a distinct surface
  fingerprint.
- Every zone must expose at least seven set dressing objects, three set dressing
  roles, five set dressing signatures, and a non-empty set dressing fingerprint.
- The world must expose at least 78 set dressing objects and 58 set dressing
  signatures.
- Every zone must expose a distinct place-architecture family, four to five
  place-architecture objects, at least three place-architecture roles, at least
  four place-architecture signatures, a non-empty fingerprint, and local bounds
  tall/wide/deep enough to read as a mini-place rather than loose props.
- The world must expose at least 40 and at most 50 place-architecture objects,
  one unique family per zone, at least 40 place-architecture signatures, no
  duplicate signatures, and keep the total scene object count <= 1080 for V3.0.
- The world must expose at least 55 signature artifact objects and 45 signature
  artifact signatures, with no duplicate signature and every zone carrying its
  own signature artifact fingerprint.
- Active signature artifacts must be visible at the loaded state and every real
  keyboard checkpoint, with minimum screen size, visible canvas ratio, limited
  UI occlusion, no center occlusion by HUD/panel/mini-map/mobile controls, and
  a sampled canvas ROI proving rendered contrast and color detail.
- Active place composition must be visible at the loaded state, every real
  keyboard checkpoint, and every mini-map destination covered by the QA profile:
  landmark, place architecture, and signature artifact must all project to
  readable screen rectangles, remain outside UI center occlusion, and form a
  bounded union with enough canvas brightness, edge density, and color buckets.
- Mini-map destination checks must run the same signature artifact visibility
  gate for each zone covered by the active QA profile.
- Mini-map destination checks must also run `place-composition-visible`; the
  aggregate `place-composition-coverage` gate must cover four zones in quick
  profile and all ten zones in full profile.
- Mini-map destination checks must also collect a perceptual close-up proof for
  each covered zone: 64-bit ROI hash, bright ratio, edge density, color bucket
  count, generic hash balance, artifact area, and artifact visible ratio.
- The aggregate `zone-perceptual-distance` gate must cover four zones in quick
  profile and all ten zones in full profile, reject duplicate hashes, reject weak
  ROI proofs, and keep the nearest-neighbor hamming distance above the calibrated
  profile threshold.
- The fake lighting layer must stay deliberately cheap: two additive light-pool
  meshes, no more than two real Three.js lights, no more than one shadow-casting
  light, visible active/route pools, and measured opacity/scale in the QA
  snapshot.
- The production URL must not expose `window.__IT_ART_STUDIO_QA__` or
  `window.__IT_ART_STUDIO_QA_STEP__` or `window.__IT_ART_STUDIO_QA_REFRESH__`;
  those are reserved for QA URLs so the public runtime avoids repeated scene
  inventory traversal.
- Directional keyboard controls must be proven with real `keyboard.down/up`
  events in `?qa=1&realKeys=1`: ArrowUp moves forward in the rover axis,
  ArrowDown moves backward in that same axis, ArrowLeft and ArrowRight rotate
  the rover without direct lateral strafing, and every proof must increment
  keyboard down/up counters over live frames.
- `real-drive-arcade-keyboard` must use an open-loop keyboard tape in
  `?qa=1&realKeys=1`: no deterministic QA step hook, no waypoint-based steering
  decision, released keys between segments, at least 300 physics samples, strong
  distance and map span, bounded per-frame displacement, acceleration, braking,
  left/right turn evidence, drift samples, drag release proof, visible rover,
  camera stability, route/off-route telemetry, and route encounter intensity.
- `surface-material-physics` must prove authored playable materials separately
  from the drive tape: at least 3 water regions, 5 ramp regions, water and ramp
  samples, material transitions, water intensity, ramp ride height, and emitted
  surface FX.
- The central identity ribbon must remain a 3D world object: at least 60
  semantic pieces, one `identity-ribbon` role, visible screen-space bounds,
  sampled ROI detail, measurable multi-frame motion, and no scene-object budget
  regression above the named premium-world budget.
- Project artifacts must read as materialized specimens, not primitive markers:
  all 10 zones keep one instanced kit each, cover the five specimen families,
  expose detail profiles, relief signatures, procedural part counts and unique
  vertex counts, while preserving `projectArtifactSceneObjects <= 10` and
  `sceneObjects <= 940`.
- `project-themed-assets` protects the four priority locations from generic
  props: Observability, Cloud, Design and Contact must expose a themed manifest,
  exact semantic roles, and role-to-relief signatures that prove each role is
  carried by actual geometry.
- `themed-set-dressing` protects the environmental layer from becoming generic:
  Cloud Dock must expose server racks, cloud puffs and an electric arc;
  Observability Tower must expose a metric screen, signal stack and trace beam;
  Design Atelier must expose canvas, swatches and paint tooling; Contact Portal
  must expose a postal desk, mail tray, sorting belt and reply field, all
  without increasing the `sceneObjects <= 940` budget.
- `priority-place-composition-visible` is the visual guardrail for those roles:
  the four priority zones must project landmark, set dressing, place
  architecture and signature artifact together, with unoccluded centers and a
  non-flat canvas ROI.
- `project-artifact-premium-visual-coverage` must prove the sampled mini-map
  specimens are large, unobstructed, bright enough, edge-rich and color-rich
  enough to read as premium 3D assets.
- Route surfaces must read as modeled playable ribbons, not flat strokes:
  `route-surface-materialized` checks rendered route-surface objects, detail
  parts, unique signatures, a bounded vertex budget and a slim visual profile
  so roads guide exploration without becoming black bars on mobile, while
  preserving `sceneObjects <= 940`.
- World richness must prove the authored world now contains water and relief:
  at least 3 `water-body` basins, 5 `relief-ramp` instances, thematic districts,
  route lights and the central identity ribbon, all inside the same premium
  world budget.
- `audio-layer` must prove the browser can initialize sound from a user action,
  expose engine, ambience, acceleration, drift, water and ramp gains while
  driving in `?qa=1&realKeys=1`, prove distinct tech/art/studio zone audio
  signatures from mini-map navigation, keep the toggle state visible, and mute
  every observable gain back to zero.
- `premium-world-detail-distribution` samples each screenshot canvas outside
  UI rectangles and rejects viewports with too many flat tiles, not enough rich
  tiles, weak median edges, weak color buckets or a large flat cluster.
- The real keyboard tour must prove route continuity: at least 180 frames, 40
  units travelled, 16 active trail marks, stable camera distance/lag, no
  invisible player samples, and only bounded active-zone invisibility while the
  rover is between places.
- The real keyboard tour must prove route adherence: at least 45 surface samples,
  route adherence >= 0.86, off-route ratio <= 0.14, max off-route distance <=
  2.8, and all expected IT/STUDIO/ART route ids covered.
- Route guidance must materialize the drive graph: every segment visualized,
  chevron and stud roles present for each segment, guidance marker count
  reported in drive telemetry, and scene object count kept within the V2.8
  budget.
- Route encounters must materialize one lightweight gate per world route, keep
  the total scene object count within the V3 budget, and be triggered by the
  real keyboard tour. The tour must visit at least five route encounters, reach
  a measured max intensity >= 0.45, and include studio, tech, and art route
  families.
- Route encounter setpieces must keep that one-gate-per-route contract while
  replacing plain rings with typed procedural micro-levels. The QA snapshot must
  expose at least four profiles, seven internal parts per gate, rich semantic
  roles, unique signatures, and keep the strict `sceneObjects <= 940` budget.
- Premium landmark hierarchy must prove that Cloud Dock, Design Atelier and
  Contact Portal each expose a dominant themed signature family, not only small
  props. The gate checks required families, role prefixes, semantic object
  counts, physical scene-object caps, bounds and at least 24 free slots under
  the strict 940-object world budget.
- Foundry printer hierarchy must prove that 3D Foundry reads as a modeled
  printer/scanner place: one instanced physical asset can expose rails, bed,
  resin basin and extruder semantics, but it must keep dominant bounds,
  `signatureArtifactSceneObjects <= 6`, and at least 24 free scene slots.
- Foundry visual proof must also pass through the priority mini-map composition
  proof, with the signature artifact visible after UI occlusion and a non-flat
  ROI. `renderer-budget` caps V7.3 at 390 calls, 110k triangles, 340 geometries
  and 24 textures so asset quality does not silently become runtime debt.
- Water level design must prove that water is a playable map feature, not a
  flat decorative material: every water body exposes signed crossing planks,
  enough distinct surface roles, and stays under the strict premium scene
  budget.
- Static production QA must produce a Bruno-Simon-style playable proof reel, not
  only a runtime smoke test. Local full scope keeps auditable captures for home,
  all ten mini-map zones, three real-keyboard route encounters, and a
  mobile/touch pass on the built artifact; GitHub Actions uses the same gate in
  compact scope over three representative zones, one stable real-keyboard route
  encounter, and mobile/touch to keep Pages deploys bounded.
- `bruno-simon-grade-objective` is the next blocking product bar: QA evidence
  must protect modeled place assets, clean textures, water, relief, free-roam
  traversal without invisible blockers, arcade acceleration/braking/drift,
  responsive engine/audio layers, and capture-ready level readability.
- The next asset-first loop must validate the GLB/glTF library before map
  expansion: every accepted asset needs source, license, file weight, texture
  list, triangle budget, narrative role, fallback, and at least one visible
  capture proof once integrated.
- `external-asset-preview-runtime` opens `?assets=preview`, loads one accepted
  GLB specimen for each terrain role, verifies GitHub Pages-safe public paths,
  waits for all files to resolve, and captures a non-flat preview before any
  full map replacement work begins.
- Asset envelope checks use a bounded measurement tolerance for headless browser
  and animation-phase differences, while still requiring non-empty geometry,
  local placement, vertical clearance, and premium scene-object budgets.
- Playable stage dominance must prove more than low aggregate UI coverage. The
  runner measures unioned UI occlusion, a clear center-stage rectangle, rover
  projection, and active place-composition occlusion. Desktop/tablet views must
  keep at least 76% of the viewport free for the 3D world; mobile views must
  keep at least 56% free while preserving touch targets and simplified zone
  navigation.
- Route encounter visibility must be proven after real keyboard driving, not by
  teleports or DOM mutation. The runner drives to a known encounter, then checks
  `screen.playerRect` and `screen.activeRouteEncounter` for visible screen-space
  bounds, low UI occlusion, sufficient active intensity, and sampled canvas ROI
  detail.
- Scene graph headroom must keep the full rendered world below 1040 scene
  objects. Route guidance may optimize implementation details, but it must still
  expose one chevron and one stud per visualized segment, one encounter gate per
  route, matching signatures, motion roles, and all gameplay visibility gates.
- Premium scene headroom must keep at least 24 scene-object slots free under
  the strict 940-object world budget. Global beacon posts must remain visible as
  24 semantic pieces while being rendered through two physical scene objects.
- Prop cluster instancing must keep the full rendered world below 955 scene
  objects while preserving all declared props semantically: every declared prop
  cluster must be instanced, the global instanced prop count must match the
  declared prop count, at least 78 scene objects must be recovered from the V3.5
  baseline and at least 120 from the V3.4 baseline, and all visual richness,
  composition, perceptual and real keyboard gameplay gates must remain green in
  the full profile.
- The real keyboard tour must prove kinematic driving: at least 90 physics
  samples over 120 frames, 75 moving samples, 35 input samples, 18 coasting
  samples, peak speed between 8 and 18 units/s, bounded acceleration and turn
  rates, p95 acceleration <= 82, normalized per-frame displacement <= 2.35, and
  a measured drag release.
- The world must expose at least six terrain layers including a shared
  visual/physics heightfield: height range >= 0.45, at least six terrain
  features, bounded vertex count, measurable grade, and scene object budget
  preserved.
- `vehicle-terrain-response` must drive with real keys across multiple terrain
  features and prove variable terrain height, stable ground clearance, and
  pitch/roll response to sampled terrain normals.
- Rendered semantic material variants must cover the variants declared by the
  zone spec.
- Applied animation hints must match the zone spec.
- The world must expose enough motion roles to prove visual details are
  animation-ready, not static decoration only.
- Every zone must expose at least three local motion behavior families, and the
  world must expose at least five behavior families overall.
- The playable avatar must expose modeled parts, four wheels, and minimum 3D
  bounds.
- The playable avatar must leave at least 18 reusable trail marks, with active
  visible marks after keyboard traversal.
- Each keyboard and mini-map zone change must increase
  `activeFeedback.sequence`, expose at least three activation rings, eight
  sparks, nine visible feedback objects, max opacity >= 0.12, and max scale >=
  1.06 in the short activation window.
- Real keyboard tour must run without `window.__IT_ART_STUDIO_QA_STEP__`, visit
  `ai-lab`, `observability-tower`, `design-atelier`, and `contact-portal`, and
  only count zone destinations as reached once the zone is truly active. It must
  span at least 40 rendered frames and 26 world units, cover both axes, rotate
  the player while moving, leave visible trail marks, keep camera distance in
  budget, and avoid single-sample jumps larger than the physical threshold.
  Input telemetry must show balanced real keydown/keyup events, no active keys
  left behind, and no deterministic hook calls during the route.
- Real keyboard physics must prove acceleration, braking/drag, bounded turn
  rate, lateral slip, and measurable drift without allowing stationary spin as
  the primary turning behavior.
- Real keyboard free-roam must drive to an off-route field, prove the rover can
  leave the route graph, and still keep the player visible without snap-back or
  invisible obstacle behavior.
- Camera safe-area checks must prove that the projected rover stays visible
  throughout sampled real keyboard driving, that each reached active zone is
  visible at stabilized checkpoints and not under fixed UI surfaces, and that
  camera lag stays within the calibrated budget during the tour.
- Frame telemetry must be present in the QA snapshot.
- Runtime frame budget warms up briefly, then must record at least 85 rendered
  frames over a 6s live window before screenshot sampling begins, with
  approximate FPS >= 14 and average frame time <= 75ms. If the first sample hits
  a warm-up stall, the runner retries once at the same thresholds and reports
  the first attempt; thresholds are not lowered by the retry. The report still
  keeps the raw frame count, FPS, and average frame time visible for performance
  tracking.
- Keyboard route must reach:
  - `ai-lab`
  - `design-atelier`
  - `contact-portal`
- Contact zone must expose a focusable `mailto:` CTA.
- The visible brand must expose exact `IT`, `ART`, and `STUDIO` tokens with
  distinct colors, and the hero title must remain visible.
- Desktop mini-map pins must synchronize all ten zones, active state, pointer
  input mode, marker position, and `aria-pressed`.
- Actionable UI controls must pass DOM rectangle, viewport, CSS visibility,
  disabled-state, and hit-test gates before Playwright clicks them.
- Visible zone navigation groups must expose exactly one active zone.
- Responsive visible UI controls must not overlap.
- Responsive UI coverage must stay below the configured desktop/mobile budget:
  34% on desktop/tablet landscape and 50% on mobile/touch layouts.
- The contact CTA must remain visible, hit-testable, and at least 44px tall on
  responsive captures when the active zone exposes it.
- Visible text must not overflow.
- Mobile controls must keep 44px minimum tap targets.
- Reduced-motion QA snapshots must report reduced motion.
- Browser page errors fail the run.

## Runtime Contract

The game exposes `window.__IT_ART_STUDIO_QA__` with:

- `ready`
- `activeZoneId`
- `activeZoneLabel`
- `zoneCount`
- `world`
  - `routeSurfaceObjects`
  - `routeSurfaceDetailSignatures`
  - `routeSurfaceDetailParts`
  - `routeSurfaceVertexCount`
  - `placeArchitectureObjects`
  - `placeArchitectureFamilies`
  - `placeArchitectureSignatures`
  - `projectArtifactObjects`
  - `projectArtifactSceneObjects`
  - `projectArtifactZones`
  - `projectArtifactActivityTypes`
  - `projectArtifactSignatures`
  - `projectArtifactMaterials`
  - `projectArtifactManifests`
  - `projectArtifactThemeRoles`
  - `projectArtifactRoleReliefSignatures`
  - `projectArtifactSpecimenFamilies`
  - `projectArtifactDetailProfiles`
  - `projectArtifactReliefSignatures`
  - `projectArtifactPartCount`
  - `projectArtifactVertexCount`
  - `terrainFeatureMarkerObjects`
  - `terrainFeatureMarkerSceneObjects`
  - `terrainFeatureMarkerSignatures`
  - `terrainFeatureMarkerProfiles`
- `player`
- `trail`
- `drive`
  - `dynamics`
  - `vehicleFeel`
  - `physicsSamples`
- `camera`
- `screen`
  - `activeProjectArtifact`
- `renderer`
  - `calls`
  - `triangles`
  - `geometries`
  - `textures`
- `externalAssets`
  - `loaded`
  - `failed`
  - `terrainRoles`
  - `publicPaths`
  - `bounds`
  - `heroLocationIds`
  - `heroLocationPlacements`
  - `heroLocationPlacementCounts`
  - `heroLocationRoles`
  - `heroLocationScreenRects`
  - `maxNonHeroClusterDensity`
  - `maxHeroLocationClusterDensity`
- `lighting`
- `canvas`
- `frameCount`
- `averageFrameMs`
- `visitedZoneIds`
- `reducedMotion`
- `lastInputMode`
- `errors`

The root `[data-game-root]` also receives `data-active-zone`.
In QA mode the game also exposes `window.__IT_ART_STUDIO_QA_STEP__()` for
deterministic keyboard-route scenarios. The deterministic driver follows the
same vehicle contract as real input: turn toward the target first, then drive
forward.

`terrain-feature-markers` proves that terrain relief is not only present in the
heightfield telemetry: each shared physics feature has instanced visual markers
with terrain profiles, while preserving the premium scene headroom.

`vehicle-suspension-response` proves that the rover translates terrain into
mechanical feel: each wheel samples the shared terrain, visible suspension parts
compress independently, and the QA report exposes peak compression, travel
variance and terrain contact span.

`tech-place-distinctiveness` protects the two main tech places from collapsing
into the same cyan signal language. AI Lab must read as a horizontal agent
workshop, Observability Tower as a vertical telemetry lighthouse, with role,
silhouette and perceptual-distance evidence.

`external-asset-map-composition` protects the asset-first direction. In
`?assets=map`, every hero location must expose dedicated placements, multiple
visual roles, screen rectangles, and focused screenshots before any GLB cluster
is promoted to the public runtime.
Non-hero clusters stay capped for noise control; hero-location clusters have a
separate density cap because recognisable places need more authored parts than
generic terrain samples.
The scenario also verifies the first custom signature roles:
`server-cloud-node`, `mannequin-fabric-rack`, and `telemetry-radar-mast`.
Accepted runtime paths may come from `assets/models/vendor/` or
`assets/models/local/`; both must remain GitHub Pages-safe and must never point
through `public/`.

`terrain-shell-runtime` protects the V9.7 empty-map expansion. The runner reads
the world size and roam extent from `src/game/world-config.ts`, then checks the
manifest `terrainShell` contract against runtime telemetry: larger boundary,
water regions, ramps, linked terrain features, scenery roles, heightfield
range, grade and renderer caps. This keeps future map expansion tied to the
asset-first plan instead of hidden QA constants.

`asset-utilization-wave` protects the V9.8 library-utilization step. The
manifest names accepted GLB files and placement ids that must be present in
`?assets=map`; Playwright then verifies the files, placements, unique-file
floor, map placement floor and renderer cap. This catches the failure mode where
the library grows on disk but the visible map still relies on old procedural
vocabulary.

## Next Gates

- Add production preview mode.
- Run against a production preview server once Playwright is available in CI.
