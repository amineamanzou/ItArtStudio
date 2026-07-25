# IT Art Studio QA Protocol

This folder defines the interactive QA gate for the 3D brand experience.
Generated artifacts are written to `qa/artifacts/` and ignored by Git.

## Command

```bash
npm run qa:game
```

The runner:

- starts the local Astro dev server;
- opens Chromium through Playwright;
- waits for `html.game-ready` and `window.__IT_ART_STUDIO_QA__`;
- verifies that the WebGL canvas renders non-dark pixels;
- drives the player with keyboard input through tech, art, and contact zones;
- checks that the contact CTA becomes a visible `mailto:` link;
- captures desktop and mobile screenshots;
- checks mobile HUD, panel, and controls for overlap;
- writes `report.json`, `report.md`, and screenshots under `qa/artifacts/`.

## Current Gates

- Canvas must be non-blank.
- Keyboard route must reach:
  - `ai-lab`
  - `observability-tower`
  - `design-atelier`
  - `contact-portal`
- Contact zone must expose a focusable `mailto:` CTA.
- Mobile visible UI controls must not overlap.
- Browser page errors fail the run.

## Runtime Contract

The game exposes `window.__IT_ART_STUDIO_QA__` with:

- `ready`
- `activeZoneId`
- `activeZoneLabel`
- `zoneCount`
- `player`
- `canvas`
- `frameCount`
- `averageFrameMs`
- `visitedZoneIds`
- `reducedMotion`
- `lastInputMode`
- `errors`

The root `[data-game-root]` also receives `data-active-zone`.

## Next Gates

- Add reduced-motion run.
- Add mini-map pin traversal.
- Add viewport captures for `1024x768`, `820x900`, and `320x700`.
- Add screenshot color-family and UI coverage checks.
- Run against a production preview server once Playwright is available in CI.
