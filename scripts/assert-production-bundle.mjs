import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = new URL("../dist/", import.meta.url);
const indexPath = new URL("index.html", distDir);
const distPath = fileURLToPath(distDir);

const html = await readFile(indexPath, "utf8");
const moduleSources = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)].map(
  (match) => match[1]
);
const rawTypeScriptModules = moduleSources.filter((source) => /\.tsx?(?:[?#].*)?$/i.test(source));
const inlineModules = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

const distFiles = await listFiles(distPath);
const emittedTypeScript = distFiles
  .filter((path) => [".ts", ".tsx"].includes(extname(path)))
  .map((path) => path.replace(distPath, ""));
const emittedJavaScript = distFiles
  .filter((path) => [".js", ".mjs"].includes(extname(path)))
  .map((path) => path.replace(distPath, ""));

if (rawTypeScriptModules.length > 0 || emittedTypeScript.length > 0 || emittedJavaScript.length > 0 || inlineModules.length !== 1) {
  console.error("Production bundle must contain exactly one inline hero controller and no script asset or raw TypeScript.");
  console.error(JSON.stringify({ rawTypeScriptModules, emittedTypeScript, emittedJavaScript, inlineModules: inlineModules.length }, null, 2));
  process.exit(1);
}

console.log("Production bundle contains one inline hero controller and no raw TypeScript.");
