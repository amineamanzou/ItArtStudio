# Carine Hero Stills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce three identity-consistent 9:16 studio stills of Carine that form a white-to-red upward camera movement for a later hero video.

**Architecture:** Generate the eye-level portrait first from all five source photographs, then use that canonical portrait alongside the originals when generating the intermediate and floor-level shots. Keep the full-resolution generated sources outside `public/` until the sequence is approved for animation.

**Tech Stack:** Built-in image generation, local image inspection, project media assets.

## Global Constraints

- Preserve Carine's face, dark skin tone, natural skin texture, long thin locs, black wide-brim hat, silver septum ring and all-black outfit.
- Use one minimal dark studio cyclorama with no architecture, furniture, text, logo or additional person.
- Produce vertical 9:16 photorealistic editorial stills.
- Do not add video playback in this iteration.
- Do not publish or merge the generated images without a separate explicit instruction.

---

### Task 1: Frontal identity anchor

**Files:**
- Create: `media/carine-hero-sequence/frame-03-frontal-red.png`

**Interfaces:**
- Consumes: the five supplied photographs as identity references.
- Produces: the canonical face, hair, hat, septum and outfit reference for Tasks 2 and 3.

- [ ] **Step 1: Generate Frame 03 with the built-in image tool**

Use this prompt:

```text
Use case: identity-preserve
Asset type: final frame of a vertical website hero film
Input images: Images 1-5 are identity and outfit references for the same real person; preserve the subject, do not preserve the exterior location or yellow lighting.
Scene/backdrop: seamless minimal black studio cyclorama, no props.
Subject: Carine, eye-level frontal head-and-shoulders portrait, shoulders square, direct calm gaze. Preserve her exact facial proportions, dark skin tone and natural texture, long thin locs, black wide-brim hat, silver septum ring, black structured coat and black top.
Style/medium: photorealistic restrained editorial fashion photography, real pores, hair strands and fabric texture.
Composition/framing: vertical 9:16, centered portrait, 85 mm portrait-lens feeling, enough headroom for later motion interpolation.
Lighting/mood: deep red wash behind and around the subject, soft neutral-white key light on the face so identity and skin tonality remain exact, subtle red rim on coat and locs.
Constraints: same real person as all references; accurate hat, septum and locs; anatomically correct face and hands; no beauty retouching; no facial redesign.
Avoid: yellow light, exterior architecture, extra jewelry, extra people, text, logo, watermark, plastic skin, fantasy styling.
```

- [ ] **Step 2: Inspect identity and defects**

Check face shape, eyes, nose, lips, septum placement, loc pattern, hat silhouette, skin texture, coat continuity and absence of unwanted objects. Reject the frame if any identity invariant drifts.

- [ ] **Step 3: Save the accepted full-resolution image**

Copy the generated image to `media/carine-hero-sequence/frame-03-frontal-red.png` without overwriting another version.

### Task 2: Rising intermediate frame

**Files:**
- Create: `media/carine-hero-sequence/frame-02-rising-coral.png`

**Interfaces:**
- Consumes: the five source photographs and `frame-03-frontal-red.png` as the canonical identity reference.
- Produces: a medium-long continuity frame between the floor-level and frontal shots.

- [ ] **Step 1: Generate Frame 02 with the built-in image tool**

Use this prompt:

```text
Use case: identity-preserve
Asset type: middle frame of a vertical website hero film
Input images: Images 1-5 define the real person and outfit; the generated frontal portrait defines the canonical face, hair, hat, septum and studio treatment.
Scene/backdrop: the exact same seamless minimal black studio cyclorama as the frontal anchor.
Subject: the same Carine, medium-long American shot, three-quarter orientation, mild low angle, one hand naturally touching the hat brim. Preserve face, skin, locs, hat, silver septum ring, black long structured coat, black top and trousers.
Style/medium: photorealistic restrained editorial fashion photography with realistic skin, hands, hair and fabric.
Composition/framing: vertical 9:16, camera has risen from floor level and moved closer, 50 mm feeling, body visible to mid-thigh.
Lighting/mood: neutral-white key keeps the face accurate; coral-to-red edge light enters the black background and coat folds; less red than the frontal anchor.
Constraints: identical person, outfit, studio and hair arrangement; credible continuity toward the frontal anchor; anatomically correct hand.
Avoid: yellow light, exterior architecture, extra people, text, logo, watermark, facial redesign, extra fingers, glossy synthetic skin.
```

- [ ] **Step 2: Inspect continuity**

Compare directly with Frame 03 for face, locs, hat, septum and coat. Confirm the coral/red level is visibly between Frames 01 and 03.

- [ ] **Step 3: Save the accepted full-resolution image**

Copy it to `media/carine-hero-sequence/frame-02-rising-coral.png`.

### Task 3: Floor-level opening frame

**Files:**
- Create: `media/carine-hero-sequence/frame-01-low-angle-white.png`

**Interfaces:**
- Consumes: the five source photographs plus Frames 02 and 03.
- Produces: the white-lit opening frame for later image-to-video animation.

- [ ] **Step 1: Generate Frame 01 with the built-in image tool**

Use this prompt:

```text
Use case: identity-preserve
Asset type: opening frame of a vertical website hero film
Input images: Images 1-5 define the real person, full-body proportions and outfit; generated Frames 02 and 03 define the canonical identity and studio continuity.
Scene/backdrop: the exact same seamless minimal black studio cyclorama.
Subject: the same Carine in a composed full-body stance, pronounced floor-level low angle, black boots closest to camera, body rising through the frame, one hand near the hat brim. Preserve face, dark skin tone, long thin locs, black wide-brim hat, silver septum ring, long structured coat, black trousers and boots.
Style/medium: photorealistic restrained editorial fashion photography with realistic perspective, skin, hair, hands, coat and boot materials.
Composition/framing: vertical 9:16, 24 mm low-angle feeling without distorted limbs, full body readable, face visible under the hat.
Lighting/mood: sculpted neutral-white key and rim light only; deep black studio; no red yet.
Constraints: identical person and outfit; credible first position in the same upward camera move; correct anatomy and natural hand.
Avoid: yellow or red lighting, exterior architecture, extra people, text, logo, watermark, exaggerated wide-angle distortion, silhouette-only face.
```

- [ ] **Step 2: Inspect perspective and identity**

Reject limb distortion, hidden facial features or outfit changes. Confirm that Frame 01 reads as the same session before the red light enters.

- [ ] **Step 3: Save the accepted full-resolution image**

Copy it to `media/carine-hero-sequence/frame-01-low-angle-white.png`.

### Task 4: Sequence handoff

**Files:**
- Create: `media/carine-hero-sequence/sequence.json`

**Interfaces:**
- Consumes: the three accepted stills.
- Produces: ordered metadata for a later image-to-video Seedance pass.

- [ ] **Step 1: Record the ordered sequence**

Create `sequence.json` with stable filenames, frame order, camera height (`floor`, `low-chest`, `eye-level`) and lighting (`white`, `white-coral`, `deep-red-neutral-key`).

- [ ] **Step 2: Inspect the three images side by side**

Confirm identity continuity, a monotonically rising camera and a monotonically increasing red component.

- [ ] **Step 3: Commit the reviewed sources**

```bash
git add media/carine-hero-sequence
git commit -m "feat: add Carine hero source sequence"
```

