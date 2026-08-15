# IT Art Studio — Carine hero sequence and editorial refinement

## Objective

Prepare three portrait-format stills of Carine that can later be animated into the ART side of the homepage hero, while refining the public copy from concrete creative-studio and technology-consultancy references.

The current production site remains static. This iteration creates production-ready image sources and updates the copy; it does not add video playback yet.

## Visual approaches considered

1. **Three independent generations from the five source photographs.** Highest per-frame freedom, but the greatest risk of face, hair and outfit drift.
2. **One generated triptych cropped into three frames.** Strong continuity, but reduced resolution and less control over each camera angle.
3. **Identity-anchored sequential generation.** Generate the frontal portrait first from all five references, then use that portrait with the five originals to derive the middle and low-angle shots. This gives each frame full resolution while keeping one canonical face reference.

Approach 3 is selected.

## Reference-image roles

- Images 1, 4 and 5: full-body proportions, long coat, boots, hat silhouette and low-angle stance.
- Images 2 and 3: face, septum ring, long locs, hand-to-hat gesture and closer outfit details.
- All five images are identity references, not edit targets. The basilica and yellow exterior lighting are not retained.

## Shared visual invariants

- Carine remains recognizably the same real person in all three images.
- Preserve her facial proportions, dark skin tone, natural skin texture, long thin locs, black wide-brim hat and silver septum ring.
- Preserve the same all-black outfit: long structured coat, black top, black trousers and black boots.
- Use a seamless, minimal dark studio cyclorama with no architecture, furniture, text, logo or additional person.
- Photorealistic editorial fashion photography, restrained rather than glossy, with plausible fabric, skin, hair, hands and shadows.
- Vertical 9:16 framing suitable for later image-to-video interpolation and responsive hero crops.

## Three-frame storyboard

### Frame 01 — floor-level opening

- Full body from a pronounced floor-level low angle, with boots near camera and the body rising into a mostly black frame.
- Carine is composed and still, one hand near the hat brim.
- Neutral white key and rim light only; the studio stays deep black.
- Face remains readable despite the dramatic angle.

### Frame 02 — rising camera

- Medium-long / American shot from a milder low angle, three-quarter orientation.
- Camera has moved upward and closer; keep the hand-to-hat gesture as the continuity cue.
- Neutral key on the face, with coral-to-red edge light entering the dark background and coat folds.
- Same set, outfit, person and hair arrangement as Frame 01.

### Frame 03 — frontal portrait anchor

- Eye-level frontal head-and-shoulders portrait, direct calm gaze.
- Deep red studio wash behind and around Carine, with a soft neutral key preserving exact facial detail and dark-skin tonality.
- Hat, locs and septum ring remain fully legible; no beauty retouching or facial redesign.
- This frame is generated first and becomes the identity anchor for Frames 02 and 01.

## Editorial research and copy rules

- Research official sites from two groups: creative studios working in direction, 3D and content; technology consultancies working in cloud, observability, AI/prototyping and training.
- Extract structures and vocabulary patterns, not paragraphs.
- Do not copy distinctive sentences. Use short source excerpts only as evidence.
- Lead with actions and deliverables: diagnose, architect, instrument, prototype, direct, model, produce.
- Remove generic creative-tech claims and avoid phrases such as “au croisement de”, “repousser les limites”, “expériences uniques”, “solutions innovantes” and “donner vie à vos idées”.
- Keep the split between IT and ART immediately understandable without pretending they form one undifferentiated service.

## Integration scope

- Save the three source stills under `public/assets/carine-hero-sequence/` with stable frame numbers.
- Keep the existing static fallback hero image until the video is produced, unless one generated still is clearly stronger and passes responsive QA.
- Update homepage wording only after the research synthesis is checked against the legal activity and actual services.
- Preserve the legal page, canonical email and no-placeholder/no-broken-link contracts.

## Validation

- Inspect each generated frame for identity, hair, hat, septum, hands, clothing continuity, lighting progression and unwanted objects.
- Verify the three images form a credible upward camera movement and white-to-red lighting transition.
- Run source review, Astro diagnostics, production build and responsive QA after copy integration.
- Do not publish or merge this branch without a separate explicit instruction.
