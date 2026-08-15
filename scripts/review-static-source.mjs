import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "src/data/site.ts",
  "src/layouts/BaseLayout.astro",
  "src/pages/index.astro",
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
  "Architecture, cloud et scaling",
  "IA, produit et prototypes",
  "Formation et accompagnement",
  "Design 3D et direction visuelle",
  "Contenu et collection",
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

console.log("Static source contract is complete.");
