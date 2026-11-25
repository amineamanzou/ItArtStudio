import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

const files = await listFiles(distDirectory);
const readableExtensions = new Set([".css", ".html", ".js", ".json", ".mjs", ".txt", ".xml"]);
const readableFiles = files.filter((file) => readableExtensions.has(extname(file)));
const entries = await Promise.all(
  readableFiles.map(async (file) => [relative(distDirectory, file), await readFile(file, "utf8")])
);
const output = Object.fromEntries(entries);
const bundle = Object.values(output).join("\n");
const home = output["index.html"] ?? "";
const legal = output[join("mentions-legales", "index.html")] ?? "";

assert(home.trimEnd().endsWith("</html>"), "Home emits markup after the closing html element");
assert(home.includes("IT Art Studio"), "Home missing legal name");
assert(home.includes("mailto:amine@itart.studio"), "Home missing canonical contact");
assert(home.includes("mailto:carine@itart.studio"), "Home missing ART contact");
assert(home.includes("data-hero-signature"), "Home missing the hero signature");
assert(home.includes('data-hero-field-side="art"'), "Home missing ART hero field");
assert(home.includes('data-hero-field-side="it"'), "Home missing IT hero field");
assert(
  home.indexOf('data-hero-field-side="it"') < home.indexOf('data-hero-field-side="art"'),
  "IT hero field must precede the ART field"
);
assert(home.includes('alt="Logo Orange"'), "Home must identify the Orange logo");
assert(!/<video\b/i.test(home), "Home must not ship a background video");
for (const retiredVideoAsset of ["hero-scroll.mp4", "hero-scroll.webm", "hero-scroll-poster.jpg", "hero-scroll-mobile"]) {
  assert(!home.includes(retiredVideoAsset), `Home still references a hero video asset: ${retiredVideoAsset}`);
}
const shippedHeroVideos = files
  .map((file) => relative(distDirectory, file))
  .filter((file) => /(?:^|[\\/])hero-scroll[^\\/]*$/.test(file));
assert.deepEqual(shippedHeroVideos, [], "Retired hero video and poster files must not ship");
for (const phrase of [
  "Comprendre le système. Construire ce qui doit fonctionner.",
  "Définir un langage visuel. Produire les images, les films et les objets.",
  "HWE — Hard Work Easy Everything",
  "Léo Urban",
  "Aminespired",
  "Besoin de notre art ?",
  "Besoin de notre tech ?"
]) {
  assert(home.includes(phrase), `Home missing concrete positioning: ${phrase}`);
}
assert(!home.includes("Chaque mission se termine"), "Redundant services introduction leaked into production");
assert(!home.includes("Des organisations accompagnées sur des projets critiques qui nous font confiance."), "References introduction leaked into production");
assert(!home.includes("<p>Références</p>"), "Visible references title leaked into production");
assert(!home.includes("Axxès"), "Axxès leaked into production references");
assert(!home.includes("Ylio"), "Ylio leaked into production references");
assert(!home.includes("Navigation principale"), "Retired header menu leaked into production");
assert(
  !home.includes("Conseil technique. Direction créative. Production."),
  "Retired hero strapline leaked into the production bundle"
);
for (const phrase of [
  "Transformer la complexité",
  "même exigence de fond",
  "rendre la valeur visible",
  "lecture senior",
  "qualité perçue",
  "Mettre en valeur"
]) {
  assert(!bundle.toLowerCase().includes(phrase.toLowerCase()), `Retired generic copy leaked into bundle: ${phrase}`);
}
assert(legal.includes("Société à responsabilité limitée"), "Legal page missing SARL form");
assert(legal.includes("915 019 129"), "Legal page missing SIREN");
assert(legal.includes("Hetzner Online GmbH"), "Legal page missing hosting provider");
assert(!bundle.includes("contact@itart.studio"), "Legacy contact leaked into bundle");
assert(!/href=["']#["']/i.test(bundle), "Placeholder href leaked into bundle");
assert(!/bient[oô]t disponible/i.test(bundle), "Placeholder copy leaked into bundle");
assert(!files.some((file) => /(?:three|game)[^/]*\.js$/i.test(file)), "Interactive game bundle leaked into dist");

console.log(JSON.stringify({
  files: files.length,
  htmlPages: files.filter((file) => extname(file) === ".html").length,
  contact: "amine@itart.studio",
  legalPage: true,
  interactiveBundle: false
}, null, 2));
