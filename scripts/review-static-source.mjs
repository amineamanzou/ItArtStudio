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

for (const phrase of [
  "IT Art Studio",
  "amine@itart.studio",
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
  "Axxès",
  "GCA Groupe Charles André",
  "KeyIA",
  "Enedis",
  "Ylio",
  "Odigo"
];

assert(homeSource.includes('id="references"'), "References section is missing");
assert(
  homeSource.includes("Des organisations accompagnées sur des projets critiques qui nous font confiance."),
  "Approved references statement is missing"
);

for (const clientReference of clientReferences) {
  assert(
    siteDataSource.includes(clientReference),
    `Approved client reference is missing: ${clientReference}`
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
assert(
  homeSource.indexOf("practice-services--art") < homeSource.indexOf("practice-services--it"),
  "ART services must render before IT services"
);
assert(siteDataSource.includes("art: []"), "ART references must have a dedicated empty collection");
assert(styleSource.includes("body::before"), "Continuous document axis is missing");
assert(styleSource.includes("left: 50%"), "Continuous document axis must align to the midpoint");

console.log("Static source contract is complete.");
