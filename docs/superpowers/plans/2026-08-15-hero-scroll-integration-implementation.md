# Hero Scroll Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static split-image hero with the approved corrected video and scrub its four-second camera rise from document scroll.

**Architecture:** Encode browser-ready variants and a poster in `public/assets`, render one sticky semantic hero in Astro, and isolate scroll-to-time behavior in a small client script. Extend the existing static Playwright QA to verify media loading, monotonic scrubbing, reduced-motion behavior and responsive overflow.

**Tech Stack:** Astro 7, TypeScript, CSS, HTML5 video, requestAnimationFrame, ffmpeg, ffprobe, Playwright

## Global Constraints

- The corrected source video is `/Users/amine/Downloads/hf_20260815_141538_c183d6fc-e106-499d-b6bc-012afaf05ea1.mp4`.
- The web master is silent, 1920 × 1080, 24 fps and exactly 96 frames.
- ART is left, IT is right and the central title-safe zone remains unobstructed.
- No autoplay, audio, external animation dependency or JavaScript-gated content.
- `prefers-reduced-motion` disables scrubbing and keeps a static composition.

---

### Task 1: Web-ready media

**Files:**
- Create: `public/assets/hero-scroll.mp4`
- Create: `public/assets/hero-scroll.webm`
- Create: `public/assets/hero-scroll-poster.jpg`

**Interfaces:**
- Consumes: corrected Seedance MP4 from Downloads.
- Produces: `/assets/hero-scroll.mp4`, `/assets/hero-scroll.webm`, `/assets/hero-scroll-poster.jpg`.

- [ ] Encode exactly 96 silent frames to H.264 with `yuv420p`, faststart and a 12-frame GOP.
- [ ] Encode exactly 96 silent frames to VP9 with a 12-frame GOP.
- [ ] Extract the final portrait frame as the static poster.
- [ ] Verify dimensions, frame rate, frame count, duration and absence of audio with `ffprobe`.

### Task 2: Failing hero contract

**Files:**
- Modify: `scripts/review-static-source.mjs`
- Modify: `scripts/review-static-site.mjs`
- Modify: `scripts/qa-static.mjs`

**Interfaces:**
- Consumes: the existing home-page build and static QA server.
- Produces: assertions for the hero video markup, both media formats, paused playback, scrub progress and reduced-motion fallback.

- [ ] Replace the two-image hero assertions with a single decorative video contract and poster/source checks.
- [ ] Add MP4 and WebM MIME types to the static QA server.
- [ ] Add a no-preference motion scenario that scrolls the sticky range and asserts increasing `currentTime`.
- [ ] Run `npm run check` and `npm run build`; require failure before markup implementation.

### Task 3: Sticky hero and scrub controller

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/scripts/hero-scroll.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: the three files from Task 1 and `[data-hero-scroll]` markup.
- Produces: `initHeroScroll(): () => void`, which maps sticky scroll progress to paused video time and returns cleanup.

- [ ] Replace the two image panels with one sticky video stage and semantic ART-left / IT-right copy.
- [ ] Implement scroll progress as `clamp(-sectionRect.top / (sectionHeight - viewportHeight), 0, 1)`.
- [ ] Smooth target-time changes with `requestAnimationFrame` while keeping the media paused.
- [ ] Disable listeners and show the final static composition when reduced motion is requested.
- [ ] Add responsive styling, stable central overlays and a visible scroll-progress cue.

### Task 4: Verification

**Files:**
- Verify: `qa/artifacts/static/*.png`
- Verify: `qa/artifacts/static/report.json`

**Interfaces:**
- Consumes: production build from Task 3.
- Produces: a passing source review, production bundle review and Playwright static QA report.

- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Run `npm run qa:static`.
- [ ] Inspect desktop, tablet, mobile and 320 px screenshots for title readability, subject retention and overflow.
- [ ] Commit only the intended hero integration, corrected media assets and QA updates on `codex/carine-hero-copy`.
