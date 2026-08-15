# Dual Hero Scroll Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a silent four-second 16:9 hero video whose camera rises from full-body to portrait while Carine stays left, Amine stays right, and the center remains clear for interface copy.

**Architecture:** Build three combined horizontal keyframes from the approved portrait anchors, then animate the first-to-last transition in Higgsfield with the middle frame as visual guidance. Validate a 720p review before retaining a 1080p web master.

**Tech Stack:** Higgsfield Nano Banana Pro, Higgsfield image-to-video, ImageMagick, ffmpeg, ffprobe

## Global Constraints

- Output canvas is 1920 × 1080 at 24 fps and no more than 4.0 seconds.
- Carine occupies the left third under deep-red ART lighting.
- Amine occupies the right third under electric-blue/cyan IT lighting.
- The central 35% remains dark, quiet, and free of subjects or bright details.
- Motion is a smooth monotonic camera rise; no walking, talking, axis crossing, or abrupt expression change.
- No text, logo, divider, particles, props, or audio are embedded.

---

### Task 1: Combined keyframes

**Files:**
- Consume: `/private/tmp/itart-carine-hero-sequence-20260815/carine-hero-sequence/frame-01-low-angle-white.png`
- Consume: `/private/tmp/itart-carine-hero-sequence-20260815/carine-hero-sequence/frame-02-rising-coral.png`
- Consume: `/private/tmp/itart-carine-hero-sequence-20260815/carine-hero-sequence/frame-03-frontal-red.png`
- Consume: `media/amine-hero-sequence/frame-01-low-angle-white.png`
- Consume: `media/amine-hero-sequence/frame-02-rising-cyan.png`
- Consume: `media/amine-hero-sequence/frame-03-frontal-blue.png`
- Create: `media/dual-hero-scroll/keyframe-01-low.png`
- Create: `media/dual-hero-scroll/keyframe-02-mid.png`
- Create: `media/dual-hero-scroll/keyframe-03-portrait.png`

- [ ] Generate each keyframe at 16:9 with Carine left, Amine right, and the center 35% empty.
- [ ] Inspect all three images at full frame and reject any identity drift, malformed anatomy, or center intrusion.
- [ ] Record generation identifiers and prompts in `media/dual-hero-scroll/generation.json`.

### Task 2: Four-second motion review

**Files:**
- Consume: `media/dual-hero-scroll/keyframe-01-low.png`
- Consume: `media/dual-hero-scroll/keyframe-02-mid.png`
- Consume: `media/dual-hero-scroll/keyframe-03-portrait.png`
- Create: `media/dual-hero-scroll/higgsfield-source.mp4`
- Create: `media/dual-hero-scroll/review-720p.mp4`

- [ ] Generate one image-to-video shot with a continuous low-to-eye-level camera rise and restrained subject motion.
- [ ] Download the result and create a silent 1280 × 720 review at 24 fps.
- [ ] Run `ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames -show_entries format=duration -of json media/dual-hero-scroll/review-720p.mp4` and require 1280 × 720, 24 fps, and duration at or below 4.0 seconds.
- [ ] Extract a six-frame contact sheet with `ffmpeg -i media/dual-hero-scroll/review-720p.mp4 -vf "fps=1.5,scale=640:-1,tile=3x2" -frames:v 1 media/dual-hero-scroll/review-contact-sheet.png` and verify left/right placement, identity, and title-safe center.

### Task 3: Web master after review approval

**Files:**
- Consume: `media/dual-hero-scroll/review-720p.mp4`
- Create: `media/dual-hero-scroll/hero-scroll-master.mp4`
- Create: `media/dual-hero-scroll/hero-scroll.webm`

- [ ] After explicit visual approval, retain or export the 1920 × 1080 silent master at 24 fps.
- [ ] Encode MP4 H.264 with `ffmpeg -i media/dual-hero-scroll/higgsfield-source.mp4 -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart media/dual-hero-scroll/hero-scroll-master.mp4`.
- [ ] Encode WebM VP9 with `ffmpeg -i media/dual-hero-scroll/higgsfield-source.mp4 -an -c:v libvpx-vp9 -crf 31 -b:v 0 -row-mt 1 media/dual-hero-scroll/hero-scroll.webm`.
- [ ] Re-run ffprobe on both files and require 1920 × 1080, 24 fps, no audio stream, and duration at or below 4.0 seconds.
