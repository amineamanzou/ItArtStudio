import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const distDirectory = join(root, "dist");
const artifactDirectory = join(root, "qa", "artifacts", "static");

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8"
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relativePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(distDirectory, safePath);
}

const server = createServer(async (request, response) => {
  try {
    let filePath = resolveRequestPath(request.url ?? "/");
    const metadata = await stat(filePath);
    if (metadata.isDirectory()) filePath = join(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await mkdir(artifactDirectory, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object", "Static QA server did not start");
const origin = `http://127.0.0.1:${address.port}`;

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 800 }
];

const report = [];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    const response = await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${viewport.name}: home did not return 200`);
    assert.equal(await page.locator("h1").count(), 1, `${viewport.name}: expected one h1`);
    assert(await page.locator('a[href="mailto:amine@itart.studio"]').count() > 0, `${viewport.name}: contact link missing`);
    assert.equal(browserErrors.length, 0, `${viewport.name}: browser errors: ${browserErrors.join(" | ")}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${viewport.name}: horizontal overflow of ${overflow}px`);

    const heroImages = page.locator(".hero-practice__media img");
    assert.equal(await heroImages.count(), 2, `${viewport.name}: expected two hero images`);
    for (let index = 0; index < 2; index += 1) {
      assert(await heroImages.nth(index).evaluate((image) => image.complete && image.naturalWidth > 0), `${viewport.name}: hero image ${index + 1} did not load`);
    }

    await page.screenshot({ path: join(artifactDirectory, `${viewport.name}-home.png`), fullPage: true });
    report.push({ ...viewport, page: "/", overflow, browserErrors });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const legalPage = await context.newPage();
  const legalResponse = await legalPage.goto(`${origin}/mentions-legales/`, { waitUntil: "networkidle" });
  assert.equal(legalResponse?.status(), 200, "Legal page did not return 200");
  assert.equal(await legalPage.locator("h1").count(), 1, "Legal page must contain one h1");
  assert(await legalPage.getByText("Société à responsabilité limitée", { exact: false }).count() > 0, "Legal form is missing");
  assert(await legalPage.getByText("915 019 129", { exact: false }).count() > 0, "SIREN is missing");
  const legalOverflow = await legalPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(legalOverflow <= 1, `Legal page: horizontal overflow of ${legalOverflow}px`);
  await legalPage.screenshot({ path: join(artifactDirectory, "mobile-legal.png"), fullPage: true });
  report.push({ width: 390, height: 844, page: "/mentions-legales/", overflow: legalOverflow, browserErrors: [] });
  await context.close();

  for (const path of ["/", "/mentions-legales/", "/robots.txt", "/sitemap.xml", "/assets/hero-it.avif", "/assets/hero-art.avif"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }

  await writeFile(join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, screenshots: report.length, report }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
