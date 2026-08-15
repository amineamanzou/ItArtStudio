# IT Art Studio — Hero Scroll Integration

## Objective

Use the corrected Seedance 2.5 video as the visual source for the public home-page hero. The four-second camera rise is controlled by document scroll instead of autoplay: the opening of the hero shows the low framing and the end of the sticky sequence shows the frontal portrait.

## Interaction

- The hero occupies approximately 240svh while its visual stage remains sticky at 100svh.
- Scroll progress through the sticky range maps monotonically from video time 0 to the final frame.
- Playback never runs independently; the video remains paused and JavaScript only updates `currentTime`.
- The existing central title and divider remain HTML/CSS overlays, never embedded in the video.
- ART remains on the left and IT remains on the right, matching the corrected asset.

## Media delivery

- Retain a silent 1920 × 1080, 24 fps, four-second master.
- Ship H.264 MP4 and VP9 WebM variants with frequent keyframes for responsive seeking.
- Ship a static poster for first paint, no-JavaScript display and reduced-motion display.
- Preload metadata rather than the complete asset; playback starts only through scroll input.

## Responsive and accessibility behavior

- Desktop and tablet use the full-bleed 16:9 composition.
- Narrow mobile viewports preserve both people with a contained cinematic frame rather than cropping either side.
- `prefers-reduced-motion: reduce` collapses the hero to one viewport, shows a static final composition and disables scroll scrubbing.
- The video is decorative and hidden from assistive technology; all positioning, service descriptions and links remain semantic HTML.
- The page remains fully usable when the video cannot load.

## Validation

- The production assets are 1920 × 1080, 24 fps, silent and no longer than four seconds.
- Scrolling from the beginning to the end of the hero moves `currentTime` from the first to the final frame without autoplay.
- The central title-safe space remains readable at desktop, tablet, 390 px and 320 px widths.
- Reduced-motion QA sees a static hero and no scroll-driven time updates.
- Existing copy, contact, legal, broken-link and overflow checks continue to pass.
