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
- gates every screenshot on visible canvas detail, edge transitions, and color
  buckets;
- verifies that the rendered canvas exposes tech, art, and studio color families;
- verifies that the world exposes enough 3D cartography assets, per-zone
  landmark inventory, and playable avatar parts;
- records frame telemetry before gameplay scenarios;
- drives the player with keyboard input through tech, art, and contact zones;
- runs one real `page.keyboard.press()` smoke test against the production
  keyboard listener;
- uses the `?qa=1` keyboard-step hook to keep navigation deterministic in
  headless Chromium while preserving `lastInputMode: keyboard`;
- clicks mini-map buttons through the DOM and verifies the active zone state;
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
- The playable avatar must expose modeled parts, four wheels, and minimum 3D
  bounds.
- Frame telemetry must be present in the QA snapshot.
- Keyboard route must reach:
  - `ai-lab`
  - `design-atelier`
  - `contact-portal`
- Contact zone must expose a focusable `mailto:` CTA.
- Desktop mini-map pins must synchronize all ten zones, active state, pointer
  input mode, and `aria-pressed`.
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
