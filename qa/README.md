# IT Art Studio QA Protocol

This folder defines the interactive QA gate for the 3D brand experience.
Generated artifacts are written to `qa/artifacts/` and ignored by Git.

## Command

```bash
npm run qa:game
```

By default the runner uses `http://127.0.0.1:4331/?qa=1` so it can run next
to a normal Astro dev server on `4321`. Override it with `QA_PORT` or
`QA_BASE_URL` when needed.

The runner:

- starts the local Astro dev server;
- opens Chromium through Playwright;
- waits for `html.game-ready` and `window.__IT_ART_STUDIO_QA__`;
- verifies that the WebGL canvas renders non-dark pixels;
- verifies that the rendered canvas exposes tech, art, and studio color families;
- verifies that the world exposes enough 3D cartography assets;
- drives the player with keyboard input through tech, art, and contact zones;
- runs one real `page.keyboard.press()` smoke test against the production
  keyboard listener;
- uses the `?qa=1` keyboard-step hook to keep navigation deterministic in
  headless Chromium while preserving `lastInputMode: keyboard`;
- clicks mini-map pins and verifies the active zone state;
- runs responsive captures for desktop, tablet, mobile, and small mobile;
- runs a reduced-motion viewport;
- checks that the contact CTA becomes a visible `mailto:` link;
- captures screenshots for every major QA state;
- checks HUD, panel, mini-map, mobile nav, and controls for overlap;
- checks UI coverage, visible text overflow, and 44px mobile tap targets;
- reports total duration so slow QA loops are visible;
- writes `report.json`, `report.md`, and screenshots under `qa/artifacts/`.

## Current Gates

- Canvas must be non-blank.
- Canvas must expose visible tech, art, and studio color families.
- World richness must report at least 10 zones, 18 road segments, 45 decorative
  objects, and 145 scene objects.
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
- Add screenshot color-family checks.
- Run against a production preview server once Playwright is available in CI.
