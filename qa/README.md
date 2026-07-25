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
- uses the `?qa=1` keyboard-step hook to keep navigation deterministic in
  headless Chromium while preserving `lastInputMode: keyboard`;
- opens a separate `?qa=1&realKeys=1` page where the deterministic keyboard
  hook is absent, then drives a waypoint tour with real `keyboard.down/up`
  events through the road graph;
- verifies road-surface telemetry for that real keyboard tour: route adherence,
  off-route samples, max lateral escape, and visited route ids;
- verifies kinematic drive telemetry for that real keyboard tour: physical
  samples, speed curve, acceleration, drag after release, turn rate, and
  normalized per-frame displacement;
- opens the production URL without `?qa=1` and verifies that the game reaches
  `game-ready` without exposing the heavy QA snapshot or deterministic step hook;
- projects the rover and active zone into screen coordinates, then checks that
  they stay readable and outside visible HUD, panel, mini-map, and mobile
  controls;
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
- Every zone must expose at least seven set dressing objects, three set dressing
  roles, five set dressing signatures, and a non-empty set dressing fingerprint.
- The world must expose at least 78 set dressing objects and 58 set dressing
  signatures.
- The world must expose at least 55 signature artifact objects and 45 signature
  artifact signatures, with no duplicate signature and every zone carrying its
  own signature artifact fingerprint.
- Active signature artifacts must be visible at the loaded state and every real
  keyboard checkpoint, with minimum screen size, visible canvas ratio, limited
  UI occlusion, no center occlusion by HUD/panel/mini-map/mobile controls, and
  a sampled canvas ROI proving rendered contrast and color detail.
- Mini-map destination checks must run the same signature artifact visibility
  gate for each zone covered by the active QA profile.
- The production URL must not expose `window.__IT_ART_STUDIO_QA__` or
  `window.__IT_ART_STUDIO_QA_STEP__`; those are reserved for QA URLs so the
  public runtime avoids repeated scene inventory traversal.
- The real keyboard tour must prove route continuity: at least 180 frames, 60
  units travelled, 16 active trail marks, stable camera distance/lag, and no
  invisible player samples.
- The real keyboard tour must prove route adherence: at least 45 surface samples,
  route adherence >= 0.86, off-route ratio <= 0.14, max off-route distance <=
  2.8, and all expected IT/STUDIO/ART route ids covered.
- The real keyboard tour must prove kinematic driving: at least 90 physics
  samples over 120 frames, 75 moving samples, 35 input samples, 18 coasting
  samples, peak speed between 8 and 18 units/s, bounded acceleration and turn
  rates, normalized per-frame displacement <= 2.1, and a measured drag release.
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
  approximate FPS >= 14 and average frame time <= 75ms. The report still keeps
  the raw frame count, FPS, and average frame time visible for performance
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
- Responsive UI coverage must stay below the configured desktop/mobile budget.
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
- `player`
- `trail`
- `drive`
  - `dynamics`
  - `physicsSamples`
- `camera`
- `screen`
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
