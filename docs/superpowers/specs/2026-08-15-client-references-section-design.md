# Client References Section Design

## Objective

Add a credible references section to the IT Art Studio homepage using only
organizations that the founders confirm were contracted through IT Art Studio.
The section must strengthen proof without disclosing intermediaries, inventing
case studies, or implying unsupported outcomes.

## Approved references

- bioMérieux
- Axxès
- GCA Groupe Charles André
- KeyIA
- Enedis
- Ylio
- Odigo

KLETA is intentionally replaced by Enedis. OPERA CONSEIL and other
intermediaries or former employers must not appear.

## Copy

The visible statement is:

> Des organisations accompagnées sur des projets critiques qui nous font confiance.

The heading is corrected to the feminine plural because its subject is
“organisations”. No sector, deliverable, result, metric, testimonial, or logo
usage claim is added without separate validation.

## Placement and presentation

Place the section between the services and method sections. This creates the
sequence: positioning, offers, proof, delivery method, contact.

Use a full-width typographic band with thin rules and a responsive list of
organization names. Do not use logo files, external links, cards, an automatic
carousel, or JavaScript. The names remain readable text and follow the existing
graphite, ivory, cyan, and coral system.

## Accessibility and responsive behavior

Use a semantic `section`, a single `h2`, and an unordered list. The content must
remain fully visible at 320 px, preserve the existing focus and contrast rules,
and introduce no horizontal overflow.

## Verification

The source contract must assert the section id, approved sentence, and all seven
names. Existing Astro checks, production build checks, and browser QA must stay
green on desktop, tablet, and mobile viewports.
