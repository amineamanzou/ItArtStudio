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
  verifies forward, backward, left, and right movement with real
  `keyboard.down/up` events, player deltas, frame deltas, input counters, and
  turn rotation where relevant;
- uses the `?qa=1` keyboard-step hook to keep navigation deterministic in
  headless Chromium while preserving `lastInputMode: keyboard`;
- opens a separate `?qa=1&realKeys=1` page where the deterministic keyboard
  hook is absent, then drives a waypoint tour with real `keyboard.down/up`
  events through the road graph;
- records short stabilization samples after reached waypoints so continuity
  checks prove both traversal and settled arrival states;
- verifies road-surface telemetry for that real keyboard tour: route adherence,
  off-route samples, max lateral escape, and visited route ids;
- verifies kinematic drive telemetry for that real keyboard tour: physical
  samples, speed curve, acceleration, drag after release, turn rate, and
  normalized per-frame displacement;
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
  events in `?qa=1&realKeys=1`: ArrowUp moves forward on the z axis, ArrowDown
  moves backward, ArrowLeft and ArrowRight move laterally and rotate the rover,
  and every proof must increment keyboard down/up counters over live frames.
- The central identity ribbon must remain a 3D world object: at least 60
  semantic pieces, one `identity-ribbon` role, visible screen-space bounds,
  sampled ROI detail, measurable multi-frame motion, and no scene-object budget
  regression above `955`.
- The real keyboard tour must prove route continuity: at least 180 frames, 60
  units travelled, 16 active trail marks, stable camera distance/lag, and no
  invisible player samples.
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
- The world must expose at least five terrain layers, 60 scenery objects, 24
  scenery signatures, 20 animated scenery objects, and all expected scenery
  roles: terrain edge, tech skyline, art sculpture, studio threshold, route
  light.
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
  `ai-lab`, `observability-tower`, `design-atelier`, and `contact-portal`, span
  at least 40 rendered frames and 26 world units, cover both axes, rotate the
  player, leave visible trail marks, keep camera distance in budget, and avoid
  single-sample jumps larger than the physical threshold. Input telemetry must
  show balanced real keydown/keyup events, no active keys left behind, and no
  deterministic hook calls during the route.
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
  - `placeArchitectureObjects`
  - `placeArchitectureFamilies`
  - `placeArchitectureSignatures`
  - `projectArtifactObjects`
  - `projectArtifactSceneObjects`
  - `projectArtifactZones`
  - `projectArtifactActivityTypes`
  - `projectArtifactSignatures`
  - `projectArtifactMaterials`
- `player`
- `trail`
- `drive`
  - `dynamics`
  - `physicsSamples`
- `camera`
- `screen`
  - `activeProjectArtifact`
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
deterministic keyboard-route scenarios.

## Next Gates

- Add production preview mode.
- Run against a production preview server once Playwright is available in CI.
