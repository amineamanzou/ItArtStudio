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

console.log("Static source contract is complete.");
