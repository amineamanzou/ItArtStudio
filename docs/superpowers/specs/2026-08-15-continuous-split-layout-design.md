# Continuous Split Layout Design

## Objective

Reassert the founding visual rule of IT Art Studio: the site is split by one
continuous vertical axis, with ART on the left and IT on the right. The axis
starts at the top of the page, crosses every section and the footer, and ends at
the bottom of the document.

This iteration is designed and reviewed for desktop and tablet. The existing
mobile fallback must remain functional and free of horizontal overflow, but its
final art direction is deferred.

## Hero title

The central title becomes a three-line composition around the axis:

- `IT` appears first, above the other words, on the right side of the axis;
- `ART` appears below it, on the left side of the axis;
- `STUDIO` remains the shared word, centered below `ART` across the axis.

Remove “Conseil technique. Direction créative. Production.” so no supporting
copy interrupts the vertical axis. The existing hero imagery, practice copy,
links, video scrub and wording remain unchanged.

## Continuous axis

Render one document-level one-pixel rule at the viewport midpoint. Remove the
hero-specific decorative rule so the axis does not change thickness, opacity or
color between sections. All desktop and tablet layouts use equal left and right
columns aligned to this midpoint and maintain a clear gutter on both sides of
the rule.

The header and footer also respect the split. Navigation and contact content
must not sit on top of the axis.

## Section composition

### Activity

Split the existing wording into two parallel statements: ART direction and
production on the left, IT consulting on the right. Reuse the current wording
without adding claims.

### Services

Place the ART practice and its two services in the left half. Place the IT
practice and its four services in the right half. Keep existing service titles,
descriptions and numbering.

### References

Create two durable reference columns. The left ART column is structurally ready
for future client names but renders no placeholder or promise. The right IT
column contains the currently approved references:

- bioMérieux
- Axxès
- GCA Groupe Charles André
- KeyIA
- Enedis
- Ylio
- Odigo

The approved references sentence remains unchanged.

### Method and contact

Keep both sections dark. The method title occupies the ART/left half and the
three steps occupy the IT/right half. Split the existing contact wording and
call to action across the two halves so neither crosses the axis.

## Visual system

Use the existing graphite background, ivory text, cyan IT accent, coral ART
accent, IBM Plex Sans and Instrument Serif. Remove the light method background.
Do not add new gradients, cards, rounded containers, shadows, placeholder copy,
assets, dependencies or motion.

## Verification

Extend the source contract to require the new hero word order, the absence of
the removed hero strapline, the continuous axis, the ART-left/IT-right service
order and a dedicated empty ART reference data collection. Run Astro checks,
the production build, the full browser QA and inspect desktop and tablet
screenshots. Mobile must continue to have zero horizontal overflow.
