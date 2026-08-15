# IT Art Studio — Dual Hero Scroll Video

## Objective

Create a short, silent 16:9 hero video designed to be scrubbed by page scroll. Carine represents ART on the left under red light; Amine represents IT on the right under blue light. The center remains dark and visually quiet for the site title and vertical divider.

## Visual composition

- Canvas: 1920 × 1080, 24 fps, 4 seconds (96 frames).
- Carine remains within the left third; Amine remains within the right third.
- The central 35% of the canvas contains no face, limb, hat, bright flare, or high-contrast detail.
- Both wear black against a dark charcoal studio background.
- ART uses a restrained deep-red rim light; IT uses a restrained electric-blue/cyan rim light.
- Skin tones remain natural and neither colored light contaminates the opposite side.
- No text, logo, divider, particles, props, or sound is embedded in the asset.

## Motion

The virtual camera rises continuously from a low-angle, near-full-body composition to a calm, eye-level portrait. The move is smooth and monotonic so every frame reads correctly when the browser maps playback time to scroll position. Body motion is limited to natural breathing, subtle fabric movement, and very slight hair movement. Neither subject walks, crosses the central axis, speaks, turns away, or changes expression abruptly.

## Generation strategy

First create three combined 16:9 keyframes from the approved portrait sequences: low-angle full-body, intermediate medium shot, and frontal portrait. These keyframes lock identity, left/right placement, lighting progression, and central negative space. Animate the sequence as one four-second image-to-video shot in Higgsfield, using the first and last combined frames when the selected model supports endpoint guidance.

If a single generation causes identity drift or central intrusion, generate the ART and IT motions separately against matching dark studio backgrounds and combine them with fixed masks. This fallback prioritizes layout stability over shared environmental motion.

## Validation

- Duration is no more than 4.0 seconds and the stream contains 96 frames at 24 fps.
- Resolution and aspect ratio are 1920 × 1080, 16:9.
- Carine is always left and Amine always right.
- The central title-safe zone remains clear throughout the clip.
- Faces, hair, glasses, septum ring, hat, beard, and clothing remain stable.
- The camera trajectory never reverses or jumps, making scroll scrubbing predictable.
- A 720p review is approved before producing the final web asset.

