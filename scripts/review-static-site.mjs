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
assert(home.includes("data-hero-scroll"), "Home missing scroll-driven hero");
assert(home.includes("hero-scroll.webm"), "Home missing WebM hero source");
assert(home.includes("hero-scroll.mp4"), "Home missing MP4 hero source");
assert(home.includes("hero-scroll-poster.jpg"), "Home missing hero poster");
assert(home.includes("muted"), "Hero video must be muted");
assert(home.includes("playsinline"), "Hero video must play inline");
for (const phrase of [
  "Conseil technique. Direction créative. Production.",
  "une architecture, un prototype, une équipe formée, une image ou une collection",
  "Comprendre le système. Construire ce qui doit fonctionner.",
  "Définir un langage visuel. Produire les images, les films et les objets."
]) {
  assert(home.includes(phrase), `Home missing concrete positioning: ${phrase}`);
}
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
