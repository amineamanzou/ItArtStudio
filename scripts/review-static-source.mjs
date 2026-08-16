import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "src/data/site.ts",
  "src/layouts/BaseLayout.astro",
  "src/pages/index.astro",
  "src/scripts/hero-scroll.ts",
  "src/pages/mentions-legales.astro"
];

await Promise.all(requiredFiles.map((path) => access(path)));
await assert.rejects(
  access("src/game"),
  "Legacy interactive sources must remain only in codex/interactive-world-v10-archive"
);

const sources = await Promise.all(requiredFiles.map((path) => readFile(path, "utf8")));
const source = sources.join("\n");
const siteDataSource = await readFile("src/data/site.ts", "utf8");
const homeSource = await readFile("src/pages/index.astro", "utf8");
const styleSource = await readFile("src/styles/global.css", "utf8");
const layoutSource = await readFile("src/layouts/BaseLayout.astro", "utf8");
const revealSource = await readFile("src/scripts/section-reveals.ts", "utf8").catch(() => "");

for (const phrase of [
  "IT Art Studio",
  "amine@itart.studio",
  "carine@itart.studio",
  "Observabilité et fiabilité",
  "Architecture, cloud et delivery",
  "IA et prototypes",
  "Formation et accompagnement",
  "Direction visuelle et design 3D",
  "Contenus et collections",
  "143 rue René Tachon",
  "FR79 915019129",
  "Carine Cléon-Amanzou",
  "Amine Amanzou"
]) {
  assert(source.includes(phrase), `Required public content is missing: ${phrase}`);
}

assert(!/from\s+["'][^"']*(?:game|three)[^"']*["']/i.test(source), "Interactive runtime import found");
assert(!/href=["']#["']/i.test(source), "Placeholder href found");
assert(!source.includes("contact@itart.studio"), "Legacy contact found");

for (const heroContract of [
  "data-hero-scroll",
  "hero-scroll.webm",
  "hero-scroll.mp4",
  "hero-scroll-poster.jpg",
  "prefers-reduced-motion",
  "currentTime",
  ".pause()"
]) {
  assert(source.includes(heroContract), `Hero scroll contract is missing: ${heroContract}`);
}

const clientReferences = [
  "bioMérieux",
  "GCA Groupe Charles André",
  "KeyIA",
  "Enedis",
  "Odigo"
];

const artReferences = [
  "HWE — Hard Work Easy Everything",
  "Léo Urban",
  "Aminespired"
];

assert(homeSource.includes('id="references"'), "References section is missing");
assert(
  !homeSource.includes("Des organisations accompagnées sur des projets critiques qui nous font confiance."),
  "References statement must be removed"
);
assert(!homeSource.includes("<p>Références</p>"), "Visible references title must be removed");
assert(!siteDataSource.includes("Axxès"), "Axxès must be removed from references");
assert(!siteDataSource.includes("Ylio"), "Ylio must be removed from references");

for (const clientReference of clientReferences) {
  assert(
    siteDataSource.includes(clientReference),
    `Approved client reference is missing: ${clientReference}`
  );
}

for (const artReference of artReferences) {
  assert(
    siteDataSource.includes(artReference),
    `Approved ART reference is missing: ${artReference}`
  );
}

assert(
  homeSource.includes('<span class="hero-title__it">IT</span>'),
  "Hero title must begin with IT on the right"
);
assert(
  homeSource.includes('<span class="hero-title__art">ART</span>'),
  "Hero title must place ART on the left"
);
assert(
  homeSource.includes('<strong class="hero-title__studio">STUDIO</strong>'),
  "Hero title must keep STUDIO centered below ART"
);
assert(
  !homeSource.includes("Conseil technique. Direction créative. Production."),
  "Legacy hero strapline must be removed"
);
assert(!homeSource.includes("activity-section"), "Redundant activity section must be removed");
assert(!homeSource.includes("section-heading"), "Redundant services introduction must be removed");
assert(!layoutSource.includes("site-nav"), "Header section menu must be removed");
assert(!layoutSource.includes("site-header"), "Decorative homepage header must be removed");
assert(!layoutSource.includes("Écrire au studio"), "Redundant studio contact must be removed from the header");
assert(layoutSource.includes("split-signature--footer"), "Footer must reuse the multi-line split signature");
const footerSource = layoutSource.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
assert(!footerSource.includes("mailto:"), "Footer must not repeat a contact email");
assert(footerSource.includes("company.legalForm"), "Footer must retain the legal company form");
assert(homeSource.includes("data-hero-signature"), "Persistent hero signature contract is missing");
for (const group of ["wide", "split", "mobile"]) {
  assert(
    homeSource.includes(`data-hero-video-group="${group}"`),
    `Responsive hero video group is missing: ${group}`
  );
}
for (const mobileAsset of [
  "hero-scroll-mobile.webm",
  "hero-scroll-mobile.mp4",
  "hero-scroll-mobile-poster.jpg"
]) {
  assert(homeSource.includes(mobileAsset), `Mobile hero asset is missing: ${mobileAsset}`);
}
assert(
  homeSource.indexOf("practice-services--art") < homeSource.indexOf("practice-services--it"),
  "ART services must render before IT services"
);
assert(homeSource.includes('data-reveal="split-left"'), "Left-side entrance contract is missing");
assert(homeSource.includes('data-reveal="split-right"'), "Right-side entrance contract is missing");
assert(homeSource.includes('data-reveal-kind="logo"'), "Logo reveal treatment is missing");
assert(
  homeSource.includes("method-step--${step.side}") && siteDataSource.includes('side: "left"'),
  "Left method step contract is missing"
);
assert(
  homeSource.includes("method-step--${step.side}") && siteDataSource.includes('side: "right"'),
  "Right method step contract is missing"
);
assert(homeSource.includes("Besoin de notre art ?"), "ART contact title is missing");
assert(homeSource.includes("Besoin de notre tech ?"), "IT contact title is missing");
assert(styleSource.includes("body::before"), "Continuous document axis is missing");
assert(styleSource.includes("left: 50%"), "Continuous document axis must align to the midpoint");
assert(styleSource.includes("clip-path"), "References must use a masked reveal distinct from services");
assert(styleSource.includes(".method-section::before"), "ART method ambience light is missing");
assert(styleSource.includes(".method-section::after"), "IT method ambience light is missing");
assert(styleSource.includes(".contact-section::before"), "ART contact ambience light is missing");
assert(styleSource.includes(".contact-section::after"), "IT contact ambience light is missing");
assert(revealSource.includes("IntersectionObserver"), "Section reveal controller is missing");

for (const selector of [
  "site-header",
  "services-section",
  "references-section",
  "method-section",
  "contact-section",
  "site-footer"
]) {
  const block = styleSource.match(new RegExp(`\\.${selector}\\s*\\{[^}]*}`, "s"))?.[0] ?? "";
  assert(
    !/border-(?:top|bottom)\s*:/.test(block),
    `Horizontal rule must not cross the central axis: ${selector}`
  );
}

console.log("Static source contract is complete.");
